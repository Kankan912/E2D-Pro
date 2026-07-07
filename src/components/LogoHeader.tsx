interface LogoHeaderProps {
  title: string;
  subtitle?: string;
}

export default function LogoHeader({ title, subtitle }: LogoHeaderProps) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl sm:text-3xl font-bold text-primary">{title}</h1>
      {subtitle && <p className="text-muted-foreground mt-2">{subtitle}</p>}
    </div>
  );
}
