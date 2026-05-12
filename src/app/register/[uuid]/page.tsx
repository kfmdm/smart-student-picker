import RegisterForm from "../../components/RegisterForm";

type RegisterPageProps = {
  params: Promise<{
    uuid: string;
  }>;
};

export default async function RegisterPage({ params }: RegisterPageProps) {
  const { uuid } = await params;

  return <RegisterForm sessionUuid={uuid} />;
}