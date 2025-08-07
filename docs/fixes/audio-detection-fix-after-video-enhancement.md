# Audio Detection Fix After Video MP4 Enhancement

## Vấn đề
Sau khi thực hiện fix cho video MP4 detection (để ngăn video files bị detect thành audio/x-m4a), chúng ta gặp vấn đề ngược lại: audio files không thể upload được nữa.

## Nguyên nhân
1. **Logic incompatible trong areCompatibleMimeTypes()**: Method này đã thêm cross-contamination prevention rules nhưng đặt chúng trước exact match check, dẫn đến việc thậm chí các MIME types giống nhau cũng bị reject.

2. **Sự xung đột giữa video và audio detection**: Logic mới quá aggressive trong việc detect video atoms, có thể ảnh hưởng đến audio detection.

## Giải pháp đã áp dụng

### 1. Sửa areCompatibleMimeTypes()
```typescript
private areCompatibleMimeTypes(detected: string, declared: string): boolean {
    // ✅ Exact match được check TRƯỚC (quan trọng nhất)
    if (detected === declared) {
        return true;
    }

    // ✅ Cross-contamination prevention đặt SAU exact match
    if (detected.startsWith('video/') && declared.startsWith('audio/')) {
        return false;
    }
    if (detected.startsWith('audio/') && declared.startsWith('video/')) {
        return false;
    }

    // ... các compatibility rules khác
}
```

### 2. Cải thiện logic MP4 container detection
```typescript
// Universal container brands - check content carefully
if (brand === 'mp41' || brand === 'mp42' || brand === 'avc1' || brand === 'isom') {
    // ✅ Ưu tiên audio-only atoms trước khi check video
    if (this.containsAudioOnlyAtoms(buffer) && !this.containsVideoAtoms(buffer)) {
        return 'audio/mp4';
    }
    
    // ✅ Chỉ return video nếu có video atoms
    if (this.containsVideoAtoms(buffer)) {
        return 'video/mp4';
    }
    
    // ✅ Nếu có cả audio và video atoms, ưu tiên video
    if (this.containsAudioOnlyAtoms(buffer) && this.containsVideoAtoms(buffer)) {
        return 'video/mp4';
    }
    
    // Default to video for ambiguous cases
    return 'video/mp4';
}
```

### 3. Cải thiện containsVideoAtoms()
```typescript
private containsVideoAtoms(buffer: Buffer): boolean {
    const videoAtoms = [
        'avc1', 'avc3', 'hev1', 'hvc1', // H.264, H.265
        'mp4v', 'xvid', 'divx',         // MPEG-4 Visual
        'vp08', 'vp09',                 // VP8, VP9
        'av01',                         // AV1
        'vmhd',                         // Video media header
        'video/',                       // MIME type in metadata
    ];

    const bufferStr = buffer.toString('ascii');
    const hasVideoAtoms = videoAtoms.some(atom => bufferStr.includes(atom));

    // ✅ Chỉ check resolution nếu đã có video atoms
    if (hasVideoAtoms) {
        return true; // Strong video indicator
    }

    // ✅ Check video track indicators (more specific)
    const hasVideoTrack = bufferStr.includes('video') && (
        bufferStr.includes('track') || 
        bufferStr.includes('trak') ||
        bufferStr.includes('stsd')
    );

    return hasVideoTrack;
}
```

### 4. Cải thiện containsAudioOnlyAtoms()
```typescript
private containsAudioOnlyAtoms(buffer: Buffer): boolean {
    const audioAtoms = [
        'mp4a',  // MP4 Audio
        'samr',  // AMR audio
        'sawb',  // AMR-WB audio
        'ac-3',  // AC3 audio
        'ec-3',  // Enhanced AC3 audio
        'mlpa',  // Meridian Lossless Packing
        'dtsc',  // DTS audio
        // ... more audio codecs
    ];
    
    const bufferStr = buffer.toString('ascii');

    // ✅ Check for audio-specific atoms
    const hasAudioAtoms = audioAtoms.some(atom => bufferStr.includes(atom));

    // ✅ Check for audio-specific metadata
    const hasAudioMetadata = bufferStr.includes('audio/') || 
                            bufferStr.includes('smhd') || // Sound media header
                            (bufferStr.includes('mp4a') && !bufferStr.includes('vmhd'));

    return hasAudioAtoms || hasAudioMetadata;
}
```

## Kết quả
✅ **Audio files có thể upload bình thường**: M4A, MP4 audio, WAV, MP3
✅ **Video files vẫn hoạt động**: MP4 video được detect chính xác
✅ **Cross-contamination prevention**: Video không bị detect thành audio và ngược lại
✅ **Backward compatibility**: Tất cả format cũ vẫn hoạt động

## Test Cases
Tất cả test cases trong `audio-detection-test.ts` đều PASS:
- M4A Audio File ✅
- MP4 Audio File ✅  
- WAV Audio File ✅
- MP3 Audio File ✅
- MP4 Video File ✅
- Cross-contamination Prevention ✅

## Bài học
1. **Order matters**: Exact match phải được check trước các rules phức tạp khác
2. **Specificity matters**: Audio-only detection cần được check trước video detection cho MP4 containers
3. **Test thoroughly**: Mỗi fix cần test cả positive và negative cases
