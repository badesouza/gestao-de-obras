/** Endereço a partir do GPS (OpenStreetMap). Guarda as respostas por ~11 m para não repetir consulta. */
export interface EnderecoGps { label: string | null; logradouro: string | null; numero: string | null; bairro: string | null }

const cache = new Map<string, EnderecoGps>();

export async function enderecoPorCoordenada(lat: number, lng: number): Promise<EnderecoGps | null> {
  const chave = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  const guardado = cache.get(chave);
  if (guardado) return guardado;

  const url = `https://nominatim.openstreetmap.org/reverse?` +
    new URLSearchParams({ lat: String(lat), lon: String(lng), format: 'json', addressdetails: '1', zoom: '18', 'accept-language': 'pt-BR' });
  const res = await fetch(url, { headers: { 'User-Agent': 'GestaoObras/1.0 (contato@sistema.gov.br)' }, signal: AbortSignal.timeout(8000) });
  if (!res.ok) return null;

  const data = await res.json() as {
    display_name?: string;
    address?: { road?: string; pedestrian?: string; footway?: string; house_number?: string; suburb?: string; neighbourhood?: string; city_district?: string; quarter?: string };
  };
  const a = data.address ?? {};
  const r: EnderecoGps = {
    label: data.display_name ?? null,
    logradouro: a.road ?? a.pedestrian ?? a.footway ?? null,
    numero: a.house_number ?? null,
    bairro: a.suburb ?? a.neighbourhood ?? a.city_district ?? a.quarter ?? null,
  };
  if (cache.size > 5000) cache.clear();
  cache.set(chave, r);
  return r;
}
