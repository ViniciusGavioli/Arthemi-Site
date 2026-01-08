// Script para testar rate limit com Retry-After header
// Rode: node scripts/test-rate-limit.js

async function testRateLimit() {
  const endpoint = 'http://localhost:3000/api/bookings';
  
  console.log('=== TESTE RATE LIMIT ===\n');
  console.log('Endpoint:', endpoint);
  console.log('Enviando 6 requisições POST...\n');
  
  for (let i = 1; i <= 6; i++) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      
      const retryAfter = res.headers.get('Retry-After');
      const body = await res.json();
      
      console.log(`Request ${i}:`);
      console.log(`  Status: ${res.status}`);
      if (retryAfter) {
        console.log(`  Retry-After: ${retryAfter}`);
      }
      console.log(`  Body: ${JSON.stringify(body).substring(0, 100)}`);
      console.log('');
      
      if (res.status === 429) {
        console.log('✅ Rate limit ativado com Retry-After:', retryAfter);
        break;
      }
    } catch (err) {
      console.log(`Request ${i}: ERRO -`, err.message);
    }
  }
}

testRateLimit().catch(console.error);
