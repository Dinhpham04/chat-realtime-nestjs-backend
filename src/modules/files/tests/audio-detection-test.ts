/**
 * Test cases for audio file detection after video MP4 fix
 * This ensures that audio files still work correctly after implementing video atom detection
 */

import { FileValidationService } from '../services/file-validation.service';

// Mock audio file buffers for testing
const audioTestCases = [
    {
        name: 'M4A Audio File',
        declaredMimeType: 'audio/x-m4a',
        // Simulated M4A buffer with ftyp box and audio atoms
        buffer: Buffer.concat([
            Buffer.from([0x00, 0x00, 0x00, 0x20]), // box size
            Buffer.from('ftyp', 'ascii'),           // box type
            Buffer.from('M4A ', 'ascii'),           // brand (M4A)
            Buffer.from([0x00, 0x00, 0x00, 0x00]), // minor version
            Buffer.from('M4A ', 'ascii'),           // compatible brand
            Buffer.from('mp41', 'ascii'),           // compatible brand
            // Audio-specific atoms
            Buffer.from('mp4a', 'ascii'),           // MP4 audio atom
            Buffer.from('smhd', 'ascii'),           // Sound media header
        ])
    },
    {
        name: 'MP4 Audio File (audio container)',
        declaredMimeType: 'audio/mp4',
        // Simulated MP4 audio buffer with universal brand but audio content
        buffer: Buffer.concat([
            Buffer.from([0x00, 0x00, 0x00, 0x20]), // box size
            Buffer.from('ftyp', 'ascii'),           // box type
            Buffer.from('isom', 'ascii'),           // brand (universal)
            Buffer.from([0x00, 0x00, 0x00, 0x00]), // minor version
            Buffer.from('mp41', 'ascii'),           // compatible brand
            Buffer.from('mp42', 'ascii'),           // compatible brand
            // Audio-only content
            Buffer.from('mp4a', 'ascii'),           // MP4 audio atom
            Buffer.from('smhd', 'ascii'),           // Sound media header
            Buffer.from('audio/mp4', 'ascii'),      // Audio metadata
        ])
    },
    {
        name: 'WAV Audio File',
        declaredMimeType: 'audio/wav',
        // Simulated WAV buffer
        buffer: Buffer.concat([
            Buffer.from('RIFF', 'ascii'),           // RIFF header
            Buffer.from([0x00, 0x00, 0x00, 0x00]), // file size
            Buffer.from('WAVE', 'ascii'),           // WAVE format
            Buffer.from('fmt ', 'ascii'),           // format chunk
        ])
    },
    {
        name: 'MP3 Audio File',
        declaredMimeType: 'audio/mpeg',
        // Simulated MP3 buffer with MPEG sync
        buffer: Buffer.concat([
            Buffer.from([0xFF, 0xFB, 0x90, 0x00]), // MPEG-1 Layer 3
            Buffer.from('ID3', 'ascii'),            // ID3 tag
            Buffer.from([0x03, 0x00, 0x00, 0x00]), // ID3 version
        ])
    }
];

const videoTestCases = [
    {
        name: 'MP4 Video File',
        declaredMimeType: 'video/mp4',
        // Simulated MP4 video buffer with video atoms
        buffer: Buffer.concat([
            Buffer.from([0x00, 0x00, 0x00, 0x20]), // box size
            Buffer.from('ftyp', 'ascii'),           // box type
            Buffer.from('isom', 'ascii'),           // brand (universal)
            Buffer.from([0x00, 0x00, 0x00, 0x00]), // minor version
            Buffer.from('mp41', 'ascii'),           // compatible brand
            Buffer.from('avc1', 'ascii'),           // H.264 video
            // Video-specific atoms
            Buffer.from('avc1', 'ascii'),           // H.264 codec
            Buffer.from('vmhd', 'ascii'),           // Video media header
            Buffer.from('1920', 'ascii'),           // Video resolution
        ])
    }
];

function testAudioDetection() {
    const service = new FileValidationService();

    console.log('🎵 Testing Audio File Detection After Video MP4 Fix');
    console.log('==================================================\n');

    // Test audio files
    audioTestCases.forEach((testCase, index) => {
        console.log(`Test ${index + 1}: ${testCase.name}`);
        console.log(`Declared MIME Type: ${testCase.declaredMimeType}`);

        try {
            // Simulate the detectMimeTypeFromBuffer method
            const detectedType = (service as any).detectMimeTypeFromBuffer(testCase.buffer);
            const isCompatible = (service as any).areCompatibleMimeTypes(detectedType, testCase.declaredMimeType);

            console.log(`Detected MIME Type: ${detectedType || 'null'}`);
            console.log(`Compatible: ${isCompatible}`);
            console.log(`Result: ${isCompatible ? '✅ PASS' : '❌ FAIL'}`);
        } catch (error) {
            console.log(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
            console.log(`Result: ❌ ERROR`);
        }
        console.log('');
    });

    // Test video files to ensure they still work
    console.log('🎬 Testing Video File Detection (Should Still Work)');
    console.log('================================================\n');

    videoTestCases.forEach((testCase, index) => {
        console.log(`Video Test ${index + 1}: ${testCase.name}`);
        console.log(`Declared MIME Type: ${testCase.declaredMimeType}`);

        try {
            const detectedType = (service as any).detectMimeTypeFromBuffer(testCase.buffer);
            const isCompatible = (service as any).areCompatibleMimeTypes(detectedType, testCase.declaredMimeType);

            console.log(`Detected MIME Type: ${detectedType || 'null'}`);
            console.log(`Compatible: ${isCompatible}`);
            console.log(`Result: ${isCompatible ? '✅ PASS' : '❌ FAIL'}`);
        } catch (error) {
            console.log(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
            console.log(`Result: ❌ ERROR`);
        }
        console.log('');
    });
}

// Test edge cases
function testEdgeCases() {
    const service = new FileValidationService();

    console.log('🔧 Testing Edge Cases');
    console.log('====================\n');

    // Test cross-contamination prevention
    console.log('Test: Cross-contamination Prevention');
    const isVideoAsAudioCompatible = (service as any).areCompatibleMimeTypes('video/mp4', 'audio/x-m4a');
    const isAudioAsVideoCompatible = (service as any).areCompatibleMimeTypes('audio/x-m4a', 'video/mp4');

    console.log(`Video detected as Audio compatible: ${isVideoAsAudioCompatible} (should be false)`);
    console.log(`Audio detected as Video compatible: ${isAudioAsVideoCompatible} (should be false)`);
    console.log(`Cross-contamination prevention: ${!isVideoAsAudioCompatible && !isAudioAsVideoCompatible ? '✅ PASS' : '❌ FAIL'}`);
    console.log('');
}

// Export for running tests
export { testAudioDetection, testEdgeCases, audioTestCases, videoTestCases };

// Run tests if this file is executed directly
if (require.main === module) {
    testAudioDetection();
    testEdgeCases();
}
