/**
 * killSwitchController.ts
 *
 * Three-step destructive flow:
 *   1. POST /initiate   → generates OTP, stores in DB (expires in 5 min)
 *   2. POST /verify     → validates OTP, returns a short-lived session token
 *   3. POST /execute    → terminates EC2, stops RDS, deletes S3 buckets
 *
 * NOTE: In production, step 1 should send the OTP via email or SMS rather
 *       than returning it in the response body.
 */

import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import {
  listEC2Instances,
  listS3Buckets,
  listRDSInstances,
  terminateEC2Instances,
  stopRDSInstance,
  deleteS3Bucket,
} from '../services/awsResourceService';
import { ApiResponse } from '../types';
import crypto from 'crypto';

/** GET /api/kill-switch/resources */
export async function listResources(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const clients = req.awsClients;
    const [ec2, s3, rds] = await Promise.all([
      listEC2Instances(clients),
      listS3Buckets(clients),
      listRDSInstances(clients),
    ]);

    res.json({
      success: true,
      data: {
        ec2: ec2
          .filter((r) => r.status !== 'terminated')
          .map((r) => ({ id: r.awsId, name: r.name, status: r.status, region: r.region })),
        s3: s3.map((r) => ({ id: r.name, name: r.name, region: r.region })),
        rds: rds
          .filter((r) => r.status !== 'terminated')
          .map((r) => ({ id: r.awsId, name: r.name, status: r.status, region: r.region })),
      },
    } satisfies ApiResponse);
  } catch (err) {
    next(err);
  }
}

/** POST /api/kill-switch/initiate */
export async function initiate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // Invalidate any previous unused OTPs
    await prisma.otpVerification.updateMany({
      where: { action: 'KILL_SWITCH', used: false },
      data: { used: true },
    });

    const code = String(Math.floor(100000 + Math.random() * 900000)); // 6-digit
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    await prisma.otpVerification.create({
      data: { code, action: 'KILL_SWITCH', expiresAt },
    });

    // In production: send via email/SMS. For demo, return in response.
    res.json({
      success: true,
      data: { otp: code, expiresAt },
      message: 'OTP generated. In production this would be sent via email/SMS.',
    } satisfies ApiResponse);
  } catch (err) {
    next(err);
  }
}

/** POST /api/kill-switch/verify  body: { otp: string } */
export async function verify(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { otp } = req.body as { otp: string };

    if (!otp || typeof otp !== 'string') {
      res.status(400).json({ success: false, error: 'otp is required' });
      return;
    }

    const record = await prisma.otpVerification.findFirst({
      where: {
        code: otp,
        action: 'KILL_SWITCH',
        used: false,
        expiresAt: { gt: new Date() },
      },
    });

    if (!record) {
      res.status(401).json({ success: false, error: 'Invalid or expired OTP' });
      return;
    }

    // Mark OTP as consumed
    await prisma.otpVerification.update({ where: { id: record.id }, data: { used: true } });

    // Issue a one-time execution token (stored in memory for simplicity)
    const execToken = crypto.randomUUID();
    executionTokens.set(execToken, Date.now() + 2 * 60 * 1000); // valid 2 min

    res.json({ success: true, data: { execToken }, message: 'OTP verified. Use execToken to execute.' });
  } catch (err) {
    next(err);
  }
}

/** POST /api/kill-switch/execute  body: { execToken: string, selectedResources?: { ec2?: string[], s3?: string[], rds?: string[] } } */
export async function execute(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { execToken, selectedResources } = req.body as {
      execToken: string;
      selectedResources?: { ec2?: string[]; s3?: string[]; rds?: string[] };
    };
    const expiry = executionTokens.get(execToken ?? '');

    if (!expiry || Date.now() > expiry) {
      res.status(401).json({ success: false, error: 'execToken missing, invalid, or expired' });
      return;
    }

    executionTokens.delete(execToken);

    const clients = req.awsClients;

    const [ec2Instances, s3Buckets, rdsInstances] = await Promise.all([
      listEC2Instances(clients),
      listS3Buckets(clients),
      listRDSInstances(clients),
    ]);

    const runningEC2 = ec2Instances.filter((r) => r.status === 'running').map((r) => r.awsId);
    const allS3 = s3Buckets.map((r) => r.name);
    const runningRDS = rdsInstances.filter((r) => r.status === 'running').map((r) => r.awsId);

    // If selectedResources provided, only act on the intersection with live running resources
    const targetEC2 = selectedResources?.ec2
      ? runningEC2.filter((id) => selectedResources.ec2!.includes(id))
      : runningEC2;
    const targetS3 = selectedResources?.s3
      ? allS3.filter((name) => selectedResources.s3!.includes(name))
      : allS3;
    const targetRDS = selectedResources?.rds
      ? runningRDS.filter((id) => selectedResources.rds!.includes(id))
      : runningRDS;

    const errors: string[] = [];

    if (targetEC2.length > 0) {
      await terminateEC2Instances(targetEC2, clients).catch((e) => errors.push(`EC2: ${e.message}`));
    }

    for (const bucketName of targetS3) {
      await deleteS3Bucket(bucketName, clients).catch((e) => errors.push(`S3 ${bucketName}: ${e.message}`));
    }

    for (const dbId of targetRDS) {
      await stopRDSInstance(dbId, clients).catch((e) => errors.push(`RDS ${dbId}: ${e.message}`));
    }

    // Always return success:true — errors are informational (permissions, etc.)
    // The frontend result modal will display them to the user.
    res.json({
      success: true,
      data: {
        terminatedEC2: targetEC2.length,
        deletedS3: targetS3.length,
        stoppedRDS: targetRDS.length,
        errors,
      },
      message: errors.length === 0
        ? `Kill switch executed: ${targetEC2.length} EC2 terminated, ${targetS3.length} S3 deleted, ${targetRDS.length} RDS stopped.`
        : `Partial execution — ${errors.length} error(s). Check data.errors for details.`,
    } satisfies ApiResponse);
  } catch (err) {
    next(err);
  }
}

// In-memory token store (single-process; use Redis in production)
const executionTokens = new Map<string, number>();
