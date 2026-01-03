// Test complete signup + auth flow
async function testFlow() {
    const email = `testflow${Date.now()}@example.com`;

    console.log('=== Step 1: Signup ===');
    const signupRes = await fetch('https://money-log-9obn.vercel.app/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name: 'Flow Test User',
            email: email,
            password: 'Demo123456'
        })
    });

    // Get set-cookie header
    const setCookie = signupRes.headers.get('set-cookie');
    console.log('Signup Status:', signupRes.status);
    console.log('Set-Cookie:', setCookie);

    // Extract cookie value
    const cookieMatch = setCookie?.match(/moneylog-session=([^;]+)/);
    const cookieValue = cookieMatch ? cookieMatch[1] : null;
    console.log('Cookie Value:', cookieValue ? cookieValue.substring(0, 50) + '...' : 'NOT FOUND');

    if (!cookieValue) {
        console.error('Failed to get session cookie!');
        return;
    }

    console.log('\n=== Step 2: Check /api/auth/me with cookie ===');
    const meRes = await fetch('https://money-log-9obn.vercel.app/api/auth/me', {
        headers: {
            'Cookie': `moneylog-session=${cookieValue}`
        }
    });
    const meData = await meRes.json();
    console.log('Me Response:', JSON.stringify(meData, null, 2));

    console.log('\n=== Step 3: Check /api/family with cookie ===');
    const familyRes = await fetch('https://money-log-9obn.vercel.app/api/family', {
        headers: {
            'Cookie': `moneylog-session=${cookieValue}`
        }
    });
    const familyData = await familyRes.json();
    console.log('Family Response:', JSON.stringify(familyData, null, 2));

    console.log('\n=== DONE ===');
}

testFlow().catch(console.error);
