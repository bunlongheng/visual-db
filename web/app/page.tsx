import { Suspense } from "react";
import App from "./components/App";
import Account from "./components/Account";

export default function Home() {
  return (
    <Suspense fallback={<div className="state">Loading...</div>}>
      <App account={<Account />} />
    </Suspense>
  );
}
