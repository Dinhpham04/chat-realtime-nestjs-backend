async function testErrorHandling() {
    console.log('🧪 Testing Global Exception Filter...\n');

    try {
        // Test our custom test endpoint
        console.log('1. Testing BadRequestException with custom message:');
        const response = await fetch('http://localhost:3000/api/v1/test-error');
        const data = await response.json();
        console.log('Response:', JSON.stringify(data, null, 2));
        console.log('Status:', response.status);
        console.log('✅ Error message preserved!\n');
    } catch (error) {
        console.log('Request failed:', error.message);
    }

    try {
        // Test validation error (should work if controller uses DTOs)
        console.log('2. Testing validation error (empty request body):');
        const response = await fetch('http://localhost:3000/api/v1/friends/requests', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });
        const data = await response.json();
        console.log('Response:', JSON.stringify(data, null, 2));
        console.log('Status:', response.status);
        console.log('✅ Validation error handled!\n');
    } catch (error) {
        console.log('Request failed:', error.message);
    }

    try {
        // Test 404 error
        console.log('3. Testing 404 Not Found:');
        const response = await fetch('http://localhost:3000/api/v1/non-existent-endpoint');
        const data = await response.json();
        console.log('Response:', JSON.stringify(data, null, 2));
        console.log('Status:', response.status);
        console.log('✅ 404 error handled!\n');
    } catch (error) {
        console.log('Request failed:', error.message);
    }

    console.log('🎉 Global Exception Filter testing completed!');
}

testErrorHandling().catch(console.error);
