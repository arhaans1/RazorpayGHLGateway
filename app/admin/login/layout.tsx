// This layout overrides the parent admin layout for the login page
// so it doesn't check for authentication
export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

