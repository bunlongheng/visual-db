import { Suspense } from "react";
import App from "./components/App";

export default function Home() {
  return (
    <Suspense fallback={<div className="state">Loading...</div>}>
      <App />
    </Suspense>
  );
}
