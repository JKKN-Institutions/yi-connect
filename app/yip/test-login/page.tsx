import { listTestAccounts } from "@/app/actions/yip/test-login";
import { TestLoginClient } from "./test-login-client";

export default async function TestLoginPage() {
  const data = await listTestAccounts();
  return <TestLoginClient {...data} />;
}

export const metadata = {
  title: "Test Login · YIP Platform",
  description: "One-click demo access for every stakeholder POV",
};
