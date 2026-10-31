/** The compact title row at the top of each page (DESIGN.md §7). */
export function PageTitle({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl leading-8 font-extrabold tracking-tight lg:text-[28px] lg:leading-9">
        {title}
      </h1>
      <p className="mt-1 text-muted-foreground">{children}</p>
    </div>
  );
}
