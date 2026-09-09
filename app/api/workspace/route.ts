import { consumeBudget } from '@/lib/rate-limit';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { workspace, mutate, AppError } from '@/lib/service';
import { json, failure, body } from '@/lib/http';
export async function GET() {
  try {
    const u = await getChatGPTUser();
    if (!u) throw new AppError(401, 'Inicia sesión para continuar.');
    await consumeBudget('workspace-read:' + u.userId, 120);
    return json(await workspace(u.userId));
  } catch (e) {
    return failure(e);
  }
}
export async function POST(req: Request) {
  try {
    const u = await getChatGPTUser();
    if (!u) throw new AppError(401, 'Inicia sesión para continuar.');
    const payload = await body(req);
    await consumeBudget('workspace-write:' + u.userId, 60);
    return json(await mutate(u.userId, payload));
  } catch (e) {
    return failure(e);
  }
}
