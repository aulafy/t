import Review from './review';
export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Revisión del extra · ExtraClaro',
  referrer: 'no-referrer',
  robots: { index: false, follow: false },
};
export default async function Page({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  return <Review token={(await params).token} />;
}
