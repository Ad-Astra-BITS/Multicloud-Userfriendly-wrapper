/**
 * killSwitchController.ts
 *
 * Three-step destructive flow:
 *   1. POST /initiate   → generates OTP, stores in DB (expires in 5 min)
 *   2. POST /verify     → validates OTP, returns a short-lived session token
 *   3. POST /execute    → terminates all EC2 instances + stops all RDS DBs
 *
 * NOTE: In production, step 1 should send the OTP via email or SMS rather
 *       than returning it in the response body.
 */

import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import {
  listEC2Instances,
  listRDSInstances,
  terminateEC2Instances,
  stopRDSInstance,
} from '../services/awsResourceService';
import { ApiResponse } from '../types';
import crypto from 'crypto';

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

/** POST /api/kill-switch/execute  body: { execToken: string } */
export async function execute(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { execToken } = req.body as { execToken: string };
    const expiry = executionTokens.get(execToken ?? '');

    if (!expiry || Date.now() > expiry) {
      res.status(401).json({ success: false, error: 'execToken missing, invalid, or expired' });
      return;
    }

    executionTokens.delete(execToken);

    const [ec2Instances, rdsInstances] = await Promise.all([
      listEC2Instances(),
      listRDSInstances(),
    ]);

    const runningEC2 = ec2Instances.filter((r) => r.status === 'running').map((r) => r.awsId);
    const runningRDS = rdsInstances.filter((r) => r.status === 'running').map((r) => r.awsId);

    const errors: string[] = [];

    if (runningEC2.length > 0) {
      await terminateEC2Instances(runningEC2).catch((e) => errors.push(`EC2: ${e.message}`));
    }

    for (const dbId of runningRDS) {
      await stopRDSInstance(dbId).catch((e) => errors.push(`RDS ${dbId}: ${e.message}`));
    }

    res.json({
      success: errors.length === 0,
      data: {
        terminatedEC2: runningEC2.length,
        stoppedRDS: runningRDS.length,
        errors,
      },
      message: errors.length === 0
        ? `Kill switch executed: ${runningEC2.length} EC2 terminated, ${runningRDS.length} RDS stopped.`
        : `Partial execution — ${errors.length} error(s).`,
    } satisfies ApiResponse);
  } catch (err) {
    next(err);
  }
}

// In-memory token store (single-process; use Redis in production)
const executionTokens = new Map<string, number>();
