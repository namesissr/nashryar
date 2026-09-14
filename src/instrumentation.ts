/** با بالا آمدن سرور، زمان‌بند انتشار خودکار فعال می‌شود */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startScheduler } = await import('./lib/scheduler');
    startScheduler();
  }
}
