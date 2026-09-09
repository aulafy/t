import { reviewBudget } from '@/lib/rate-limit';
import { review, publicView, decide } from '@/lib/service';
import { json, failure, body } from '@/lib/http';
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const token = (await params).token;
    await reviewBudget(token);
    return json(publicView(await review(token)));
  } catch (e) {
    return failure(e);
  }
}
export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const token = (await params).token,
      payload = await body(req);
    await reviewBudget(token, true);
    return json(await decide(token, payload));
  } catch (e) {
    return failure(e);
  }
}
