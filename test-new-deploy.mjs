// Test new deployment
async function testNewDeploy() {
    const baseUrl = 'https://money-log-psi.vercel.app';
    const email = `newdeploy${Date.now()}@test.com`;

    console.log('Testing:', baseUrl);

    console.log('\n=== 1. SIGNUP ===');
    const signupRes = await fetch(`${baseUrl}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'New Deploy Test', email, password: 'Demo123456' })
    });
    const signupData = await signupRes.json();
    const cookie = signupRes.headers.get('set-cookie')?.match(/moneylog-session=([^;]+)/)?.[1];
    console.log('Status:', signupRes.status);
    console.log('Signup:', signupData.success ? '✅ SUCCESS' : `❌ FAILED - ${signupData.error}`);
    console.log('Cookie:', cookie ? '✅ RECEIVED' : '❌ NOT FOUND');

    if (!cookie) {
        console.log('Details:', JSON.stringify(signupData, null, 2));
        return;
    }

    console.log('\n=== 2. AUTH CHECK ===');
    const meRes = await fetch(`${baseUrl}/api/auth/me`, {
        headers: { Cookie: `moneylog-session=${cookie}` }
    });
    const meData = await meRes.json();
    console.log('Authenticated:', meData.authenticated ? '✅ YES' : '❌ NO');

    console.log('\n=== 3. CREATE FAMILY ===');
    const familyRes = await fetch(`${baseUrl}/api/family`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Cookie: `moneylog-session=${cookie}`
        },
        body: JSON.stringify({ name: 'New Deploy Family' })
    });
    const familyData = await familyRes.json();
    console.log('Create Family:', familyData.success ? '✅ SUCCESS' : `❌ FAILED - ${familyData.error}`);

    console.log('\n=== 4. DASHBOARD ===');
    const dashRes = await fetch(`${baseUrl}/api/reports/summary?period=this-month`, {
        headers: { Cookie: `moneylog-session=${cookie}` }
    });
    console.log('Dashboard:', dashRes.status === 200 ? '✅ OK' : `❌ ${dashRes.status}`);

    console.log('\n========== DONE ==========');
}

testNewDeploy().catch(console.error);
