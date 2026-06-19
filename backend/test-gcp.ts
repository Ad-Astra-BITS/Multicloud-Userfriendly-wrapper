import { InstancesClient } from '@google-cloud/compute';
const client = new InstancesClient({
  credentials: {
    client_email: "test@example.com",
    private_key: "test"
  },
  projectId: "test"
});
console.log("Client created successfully");
