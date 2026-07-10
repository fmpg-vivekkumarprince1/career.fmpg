import { Suspense } from "react";
import { getPublicJobsAction } from "@/app/actions/jobs";
import JobsListClient from "@/components/jobs/JobsListClient";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

export const metadata = {
  title: "Career Openings | FMPG",
  description: "Explore current job openings at FMPG. Apply for roles in tech, operations, marketing, and more.",
};

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const search = typeof params?.search === "string" ? params.search : "";
  const type = typeof params?.type === "string" ? params.type : "";
  const department = typeof params?.department === "string" ? params.department : "";
  const location = typeof params?.location === "string" ? params.location : "";
  const page = typeof params?.page === "string" ? parseInt(params.page) : 1;
  const sort = typeof params?.sort === "string" ? (params.sort as "newest" | "oldest" | "title") : "newest";

  const res = await getPublicJobsAction({ search, type, department, location, page, limit: 12, sort });

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-grow min-h-screen bg-background pt-24 pb-16">
        <Suspense fallback={<div className="text-center py-20 text-muted-foreground">Loading openings...</div>}>
          <JobsListClient
            initialData={res.success ? (res as any).data : null}
            initialSearch={search}
            initialType={type}
            initialDept={department}
            initialLoc={location}
            initialSort={sort}
            initialPage={page}
          />
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}

