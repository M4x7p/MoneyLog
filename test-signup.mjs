// Test signup API
const data = {
    name: "API Test User",
    email: "apitest456@example.com",
    password: "Demo123456"
};

fetch('https://money-log-9obn.vercel.app/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
})
    .then(async res => {
        console.log('Status:', res.status);
        console.log('Headers:');
        res.headers.forEach((value, name) => {
            console.log(`  ${name}: ${value}`);
        });
        const json = await res.json();
        console.log('Body:', JSON.stringify(json, null, 2));
    })
    .catch(err => console.error('Error:', err));
