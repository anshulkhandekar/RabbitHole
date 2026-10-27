export function goConversation(url: string, agentUrl: string) {
  try {
    const task = new URL(url),
      agent = new URL(agentUrl);
    return task.protocol === "https:" &&
      task.origin === agent.origin &&
      /^\/tasks\/[a-zA-Z0-9_-]+\/?$/.test(task.pathname)
      ? task.origin + task.pathname.replace(/\/$/, "")
      : undefined;
  } catch {
    return undefined;
  }
}
