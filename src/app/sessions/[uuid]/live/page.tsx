import SessionLiveStage from "@/app/components/SessionLiveStage";

type LivePageProps = {
  params: Promise<{
    uuid: string;
  }>;
};

export default async function LivePage({ params }: LivePageProps) {
  const { uuid } = await params;

  return <SessionLiveStage sessionUuid={uuid} />;
}
