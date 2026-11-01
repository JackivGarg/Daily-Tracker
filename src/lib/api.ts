export async function api<T>(path:string, options:RequestInit = {}):Promise<T> {
  const response = await fetch(`/api${path}`, { ...options, headers:{ 'Content-Type':'application/json',...options.headers } });
  const data = await response.json().catch(()=>({error:'The server returned an unreadable response.'}));
  if (!response.ok) throw new Error(data.error || 'Could not save. Please try again.');
  return data as T;
}
