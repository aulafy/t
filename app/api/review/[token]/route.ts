import { review, publicView, decide } from '@/lib/service';
import { json, failure, body } from '@/lib/http';
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    return json(publicView(await review((await params).token)));
  } catch (e) {
    return failure(e);
  }
}
export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    return json(await decide((await params).token, await body(req)));
  } catch (e) {
    return failure(e);
  }
}
