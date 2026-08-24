export function preferredRecordingMimeType(){
 if(typeof MediaRecorder==="undefined")return "";
 const candidates=["audio/webm;codecs=opus","audio/mp4;codecs=mp4a.40.2","audio/mp4","audio/ogg;codecs=opus","audio/webm"];
 return candidates.find(type=>MediaRecorder.isTypeSupported?.(type))||"";
}

export function createAudioRecorder(stream:MediaStream){
 const mimeType=preferredRecordingMimeType();
 return mimeType?new MediaRecorder(stream,{mimeType}):new MediaRecorder(stream);
}
