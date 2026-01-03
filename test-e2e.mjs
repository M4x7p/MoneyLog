// Complete E2E Test
async function testComplete() {
    const email = `e2e${Date.now()}@test.com`;
    const password = 'Demo123456';

    console.log('=== 1. SIGNUP ===');
    const signupRes = await fetch('https://money-log-9obn.vercel.app/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'E2E Test', email, password })
    });
    const signupData = await signupRes.json();
    const cookie = signupRes.headers.get('set-cookie')?.match(/moneylog-session=([^;]+)/)?.[1];
    console.log('Signup:', signupData.success ? '✅ SUCCESS' : '❌ FAILED');
    console.log('Cookie:', cookie ? '✅ RECEIVED' : '❌ NOT FOUND');

    if (!cookie) return;

    console.log('\n=== 2. CHECK AUTH ===');
    const meRes = await fetch('https://money-log-9obn.vercel.app/api/auth/me', {
        headers: { Cookie: `moneylog-session=${cookie}` }
    });
    const meData = await meRes.json();
    console.log('Authenticated:', meData.authenticated ? '✅ YES' : '❌ NO');

    console.log('\n=== 3. CHECK FAMILY ===');
    const familyRes = await fetch('https://money-log-9obn.vercel.app/api/family', {
        headers: { Cookie: `moneylog-session=${cookie}` }
    });
    const familyData = await familyRes.json();
    console.log('hasFamily field:', familyData.hasFamily !== undefined ? '✅ EXISTS' : '❌ MISSING');
    console.log('hasFamily value:', familyData.hasFamily);

    console.log('\n=== 4. CREATE FAMILY ===');
    const createRes = await fetch('https://money-log-9obn.vercel.app/api/family', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Cookie: `moneylog-session=${cookie}`
        },
        body: JSON.stringify({ name: 'Test Family E2E' })
    });
    const createData = await createRes.json();
    console.log('Create Family:', createData.success ? '✅ SUCCESS' : '❌ FAILED');

    console.log('\n=== 5. CHECK FAMILY AGAIN ===');
    const family2Res = await fetch('https://money-log-9obn.vercel.app/api/family', {
        headers: { Cookie: `moneylog-session=${cookie}` }
    });
    const family2Data = await family2Res.json();
    console.log('hasFamily:', family2Data.hasFamily ? '✅ TRUE' : '❌ FALSE');
    console.log('Family Name:', family2Data.family?.name || 'N/A');

    console.log('\n=== 6. DASHBOARD DATA ===');
    const dashRes = await fetch('https://money-log-9obn.vercel.app/api/reports/summary?period=this-month', {
        headers: { Cookie: `moneylog-session=${cookie}` }
    });
    console.log('Dashboard Status:', dashRes.status === 200 ? '✅ OK' : `❌ ${dashRes.status}`);

    console.log('\n========== ALL TESTS COMPLETE ==========');
}

testComplete().catch(console.error);
