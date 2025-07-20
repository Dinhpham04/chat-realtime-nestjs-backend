async function testSourceLocation() {
    console.log('🧪 Testing Source Location Detection...\n');

    try {
        console.log('1. Testing simple error:');
        const response1 = await fetch('http://localhost:3000/api/v1/test-error');
        const data1 = await response1.json();
        console.log('Response:', JSON.stringify(data1, null, 2));
        console.log('');
    } catch (error) {
        console.log('Request failed:', error.message);
    }

    try {
        console.log('2. Testing error with stack trace:');
        const response2 = await fetch('http://localhost:3000/api/v1/test-error-with-stack');
        const data2 = await response2.json();
        console.log('Response:', JSON.stringify(data2, null, 2));
        console.log('');
    } catch (error) {
        console.log('Request failed:', error.message);
    }

    console.log('🎉 Source location testing completed!');
}

testSourceLocation().catch(console.error);
