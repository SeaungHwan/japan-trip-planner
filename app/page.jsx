import Planner from "@/components/Planner";
import AuthGate from "@/components/AuthGate";

export default function Page() {
  return (
    <AuthGate>
      <Planner />
    </AuthGate>
  );
}
