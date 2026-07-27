import Spinner from "@/components/Spinner";

export default function Loading() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-white">
      <Spinner size={28} />
    </div>
  );
}
