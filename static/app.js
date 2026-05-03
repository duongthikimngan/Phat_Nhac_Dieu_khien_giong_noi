const config = window.APP_CONFIG;

const state = {
  active: false,
  tracks: [],
  currentIndex: -1,
  objectUrls: [],
  stream: null,
  track: null,
  recorder: null,
  audioContext: null,
  analyser: null,
  sourceNode: null,
  monitoringFrame: null,
  recordedChunks: [],
  speechDetected: false,
  speakingStartedAt: 0,
  silenceStartedAt: 0,
  segmentStartedAt: 0,
  sessionId: 0,
  pendingMessage: "",
  processingCommand: false,
  waitingForRearm: false,
  permissionState: "prompt",
  hasMicAccess: false,
  permissionStatus: null,
  commandCount: 0,
  backendMicMuted: null,
  micPollTimer: null,
  rearming: false,
  awaitingHardwareMute: false,
  micPollInFlight: false,
  connectInProgress: false,
};

const elements = {
  audio: document.getElementById("audio-player"),
  playlist: document.getElementById("playlist"),
  trackTitle: document.getElementById("track-title"),
  trackMeta: document.getElementById("track-meta"),
  nowArtwork: document.getElementById("now-artwork"),
  activationState: document.getElementById("activation-state"),
  micState: document.getElementById("mic-state"),
  lastCommand: document.getElementById("last-command"),
  commandFeedback: document.getElementById("command-feedback"),
  trackInput: document.getElementById("track-input"),
  playButton: document.getElementById("play-button"),
  playToggleButton: document.getElementById("play-toggle-button"),
  stopButton: document.getElementById("stop-button"),
  nextButton: document.getElementById("next-button"),
  backButton: document.getElementById("back-button"),
  replayButton: document.getElementById("replay-button"),
  micIndicator: document.getElementById("mic-indicator"),
  commandCount: document.getElementById("command-count"),
};

function setActivationState(active) {
  state.active = active;
  elements.activationState.textContent = active ? "Đã kích hoạt" : "Chờ kích hoạt";
  elements.activationState.classList.toggle("active", active);
  elements.activationState.classList.toggle("idle", !active);
}

function setMicState(text, type = "") {
  elements.micState.textContent = text;
  elements.micState.classList.remove("active", "idle", "error");
  if (type) {
    elements.micState.classList.add(type);
  }
}

function setFeedback(message) {
  elements.commandFeedback.innerHTML = message;
}

function setMicVisualState(mode) {
  elements.micIndicator.dataset.state = mode;
}

function updateCommandCount() {
  elements.commandCount.textContent = String(state.commandCount);
}

function shouldFrontendControlMicState() {
  return Boolean(state.recorder || state.processingCommand || state.waitingForRearm);
}

function updateNowPlaying() {
  const track = state.tracks[state.currentIndex];
  if (!track) {
    elements.trackTitle.textContent = "Chưa có bài hát";
    elements.trackMeta.textContent = "Tải nhạc từ máy để bắt đầu phát";
    if (elements.nowArtwork) {
      elements.nowArtwork.src = "";
      elements.nowArtwork.alt = "Không có bìa";
    }
    return;
  }

  elements.trackTitle.textContent = track.title;
  elements.trackMeta.textContent = `Bài ${state.currentIndex + 1}/${state.tracks.length} • ${
    track.artist || "Danh sách phát cá nhân"
  }`;
  if (elements.nowArtwork) {
    elements.nowArtwork.src = track.artwork || "";
    elements.nowArtwork.alt = `${track.title} — ${track.artist || "Nhạc tải lên"}`;
  }
}

function renderPlaylist() {
  elements.playlist.innerHTML = "";

  if (!state.tracks.length) {
    const empty = document.createElement("li");
    empty.className = "playlist-empty";
    empty.textContent = "Chưa có bài hát nào trong danh sách phát.";
    elements.playlist.appendChild(empty);
    updateNowPlaying();
    return;
  }

  state.tracks.forEach((track, index) => {
    const item = document.createElement("li");
    if (index === state.currentIndex) {
      item.classList.add("active");
    }

    const copy = document.createElement("div");
    copy.className = "track-copy";
    copy.innerHTML = `
      <p class="track-title">${track.title}</p>
      <p class="track-sub">${track.artist || "Danh sách phát cá nhân"}</p>
    `;

    const action = document.createElement("button");
    action.type = "button";
    action.className = "track-action";
    action.textContent = index === state.currentIndex ? "Đang phát" : "Phát";
    action.addEventListener("click", () => selectTrack(index, true));

    item.append(copy, action);
    elements.playlist.appendChild(item);
  });
}

function syncPlayButton() {
  const isPlaying = !elements.audio.paused && !elements.audio.ended;
  elements.playToggleButton.textContent = isPlaying ? "Tạm dừng" : "Phát / Tạm dừng";
}

function selectTrack(index, autoplay = false) {
  const track = state.tracks[index];
  if (!track) {
    return;
  }

  state.currentIndex = index;
  elements.audio.src = track.url;
  updateNowPlaying();
  renderPlaylist();

  if (autoplay) {
    void elements.audio.play().catch(() => {
      setFeedback("Trình duyệt đang chặn tự phát. Hãy bấm nút phát để tiếp tục.");
      syncPlayButton();
    });
  }
}

function playTrack() {
  if (!state.tracks.length) {
    setFeedback("Chưa có bài hát nào trong danh sách phát.");
    return;
  }

  if (state.currentIndex < 0) {
    selectTrack(0, false);
  }

  void elements.audio.play().catch(() => {
    setFeedback("Không thể phát bài hát hiện tại.");
    syncPlayButton();
  });
}

function togglePlayPause() {
  if (elements.audio.paused) {
    playTrack();
  } else {
    elements.audio.pause();
  }
}

function stopTrack() {
  elements.audio.pause();
}

function nextTrack() {
  if (!state.tracks.length) {
    return;
  }

  const nextIndex = state.currentIndex >= 0 ? (state.currentIndex + 1) % state.tracks.length : 0;
  selectTrack(nextIndex, true);
}

function backTrack() {
  if (!state.tracks.length) {
    return;
  }

  const previousIndex =
    state.currentIndex > 0 ? state.currentIndex - 1 : state.tracks.length - 1;
  selectTrack(previousIndex, true);
}

function replayTrack() {
  if (!state.tracks.length) {
    return;
  }

  if (state.currentIndex < 0) {
    selectTrack(0, false);
  }
  elements.audio.currentTime = 0;
  void elements.audio.play().catch(() => {
    setFeedback("Không thể phát lại bài hát.");
    syncPlayButton();
  });
}

function normalizeCommand(command) {
  const normalized = String(command || "").trim().toLowerCase();
  if (normalized === "previous" || normalized === "prev") {
    return "back";
  }
  return normalized;
}

function handleCommand(command, confidence = null) {
  const normalized = normalizeCommand(command);
  elements.lastCommand.textContent = normalized || "Không rõ";
  state.commandCount += 1;
  updateCommandCount();

  const confidenceText =
    typeof confidence === "number" ? ` (độ tin cậy ${(confidence * 100).toFixed(1)}%)` : "";

  if (normalized === "go") {
    setActivationState(true);
    setFeedback(`Hệ thống đã được kích hoạt${confidenceText}.`);
    return;
  }

  if (!state.active) {
    setFeedback(
      `Đã nhận "${normalized}"${confidenceText}, nhưng hệ thống chưa kích hoạt. Hãy nói "go" trước.`
    );
    return;
  }

  switch (normalized) {
    case "play":
      playTrack();
      setFeedback(`Đã thực thi lệnh phát${confidenceText}.`);
      break;
    case "stop":
      stopTrack();
      setFeedback(`Đã thực thi lệnh dừng${confidenceText}.`);
      break;
    case "next":
      nextTrack();
      setFeedback(`Đã chuyển sang bài tiếp theo${confidenceText}.`);
      break;
    case "back":
      backTrack();
      setFeedback(`Đã quay lại bài trước${confidenceText}.`);
      break;
    case "replay":
      replayTrack();
      setFeedback(`Đã phát lại bài hiện tại${confidenceText}.`);
      break;
    default:
      setFeedback(`Lệnh "${normalized}" hiện chưa được hỗ trợ.`);
      break;
  }
}

function mergeTracks(newTracks) {
  state.tracks.push(...newTracks);
  if (state.currentIndex === -1 && state.tracks.length) {
    state.currentIndex = 0;
    elements.audio.src = state.tracks[0].url;
  }
  updateNowPlaying();
  renderPlaylist();
}

async function loadServerPlaylist() {
  const response = await fetch(config.playlistEndpoint);
  const payload = await response.json();
  mergeTracks(payload.tracks || []);
}

function encodeWav(samples, sampleRate) {
  const bytesPerSample = 2;
  const buffer = new ArrayBuffer(44 + samples.length * bytesPerSample);
  const view = new DataView(buffer);

  function writeString(offset, text) {
    for (let index = 0; index < text.length; index += 1) {
      view.setUint8(offset + index, text.charCodeAt(index));
    }
  }

  writeString(0, "RIFF");
  view.setUint32(4, 36 + samples.length * bytesPerSample, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, samples.length * bytesPerSample, true);

  let offset = 44;
  for (let index = 0; index < samples.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, samples[index]));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    offset += 2;
  }

  return new Blob([buffer], { type: "audio/wav" });
}

async function sendSegment(blob) {
  const formData = new FormData();
  formData.append("audio", blob, "voice-command.wav");

  const response = await fetch(config.predictEndpoint, {
    method: "POST",
    body: formData,
  });
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error || "Không thể nhận diện lệnh");
  }

  handleCommand(payload.command, payload.confidence);
}

function resetListeningState() {
  state.recordedChunks = [];
  state.speechDetected = false;
  state.speakingStartedAt = 0;
  state.silenceStartedAt = 0;
  state.segmentStartedAt = 0;
  state.pendingMessage = "";
}

function stopMonitoring() {
  if (state.monitoringFrame) {
    cancelAnimationFrame(state.monitoringFrame);
    state.monitoringFrame = null;
  }
}

function disposeAudioGraph() {
  stopMonitoring();

  if (state.sourceNode) {
    state.sourceNode.disconnect();
  }
  if (state.analyser) {
    state.analyser.disconnect();
  }

  state.sourceNode = null;
  state.analyser = null;
}

async function releaseStreamCompletely() {
  disposeAudioGraph();

  if (state.stream) {
    state.stream.getTracks().forEach((streamTrack) => streamTrack.stop());
  }

  if (state.audioContext && state.audioContext.state !== "closed") {
    await state.audioContext.close();
  }

  state.stream = null;
  state.track = null;
  state.audioContext = null;
  state.recorder = null;
  state.hasMicAccess = false;
}

function stopRecorderForExternalMute(message) {
  state.pendingMessage = message;
  if (state.recorder && state.recorder.state !== "inactive") {
    state.recorder.stop();
  } else {
    void shutdownMicrophoneSession(message);
  }
}

function updatePermissionFeedback() {
  if (state.permissionState === "denied") {
    setMicState("Micro bị chặn", "error");
    setMicVisualState("blocked");
    setFeedback(
      "Trình duyệt đang chặn micro. Hãy bật lại quyền micro từ biểu tượng micro trên thanh địa chỉ rồi quay lại trang."
    );
  }
}

async function rearmListeningAfterMicEnabled() {
  state.rearming = true;

  if (state.processingCommand || state.recorder) {
    state.rearming = false;
    return;
  }

  if (state.backendMicMuted !== false) {
    state.rearming = false;
    return;
  }

  await releaseStreamCompletely();
  await connectMicrophone();
  state.rearming = false;
}

function applySystemMicState(payload) {
  if (!payload || !payload.available) {
    return;
  }

  const previousMuted = state.backendMicMuted;
  state.backendMicMuted = Boolean(payload.is_muted);

  if (state.waitingForRearm) {
    if (state.awaitingHardwareMute && state.backendMicMuted) {
      state.awaitingHardwareMute = false;
      setMicState("Đã nhận tắt micro", "idle");
      setMicVisualState("idle");
      setFeedback("Đã nhận thao tác tắt micro từ tai nghe. Hãy bật lại một lần để tiếp tục.");
      return;
    }

    if (
      !state.awaitingHardwareMute &&
      !state.backendMicMuted &&
      !state.processingCommand &&
      !state.recorder &&
      !state.rearming
    ) {
      setMicState("Micro đã bật", "active");
      setMicVisualState("armed");
      setFeedback("Đã nhận thao tác bật micro. Hệ thống đang gài lại phiên nghe.");
      void rearmListeningAfterMicEnabled();
      return;
    }
  }

  if (state.backendMicMuted) {
    if (state.recorder && !state.processingCommand) {
      stopRecorderForExternalMute("Micro đã bị tắt từ tai nghe hoặc Windows.");
      return;
    }

    if (!shouldFrontendControlMicState()) {
      setMicState("Micro đang tắt", "idle");
      setMicVisualState("idle");
    }
    return;
  }

  if (!shouldFrontendControlMicState()) {
    setMicState("Micro đã bật", "active");
    setMicVisualState("armed");
  }
}

async function pollMicrophoneState() {
  if (!config.microphoneStateEndpoint) {
    return;
  }

  if (state.micPollInFlight) {
    return;
  }

  try {
    state.micPollInFlight = true;
    const response = await fetch(config.microphoneStateEndpoint, { cache: "no-store" });
    if (!response.ok) {
      return;
    }
    const payload = await response.json();
    applySystemMicState(payload);
  } catch (error) {
    // Keep the current UI state when system polling is unavailable.
  } finally {
    state.micPollInFlight = false;
  }
}

async function setSystemMicrophoneMute(muted) {
  if (!config.microphoneMuteEndpoint) {
    return false;
  }

  try {
    const response = await fetch(config.microphoneMuteEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ muted }),
    });
    if (!response.ok) {
      return false;
    }
    const payload = await response.json();
    if (payload && typeof payload.is_muted === "boolean") {
      state.backendMicMuted = payload.is_muted;
    }
    return true;
  } catch (error) {
    return false;
  }
}

async function processRecordedAudio(chunks) {
  try {
    state.processingCommand = true;
    setMicState("Đang xử lý lệnh", "active");
    setMicVisualState("processing");
    setFeedback("Đã dừng ghi âm. Hệ thống đang xử lý lệnh vừa nhận.");

    const blob = new Blob(chunks, { type: chunks[0].type || "audio/webm" });
    const tempContext = new AudioContext();
    const arrayBuffer = await blob.arrayBuffer();
    const audioBuffer = await tempContext.decodeAudioData(arrayBuffer.slice(0));
    const wavBlob = encodeWav(audioBuffer.getChannelData(0), audioBuffer.sampleRate);
    await tempContext.close();
    await sendSegment(wavBlob);
    await suspendListeningSession(
      "Lệnh đã được thực thi. Phiên ghi đã dừng, hãy tắt rồi bật lại micro để gửi lệnh tiếp theo."
    );
  } catch (error) {
    await suspendListeningSession(
      `Có lỗi khi xử lý âm thanh: ${error.message}. Phiên ghi đã dừng, hãy tắt rồi bật lại micro để thử lại.`
    );
  }
}

function finishListeningCycle(message, externalMuted = false) {
  state.processingCommand = false;
  state.recorder = null;
  resetListeningState();
  state.waitingForRearm = true;

  if (externalMuted || !state.track || state.track.muted) {
    setMicState("Micro đang tắt", "idle");
    setMicVisualState("idle");
  } else {
    setMicState("Chờ bật lại micro", "idle");
    setMicVisualState("armed");
  }

  setFeedback(message);
}

async function shutdownMicrophoneSession(message) {
  await releaseStreamCompletely();
  finishListeningCycle(message, true);
}

async function suspendListeningSession(message) {
  await releaseStreamCompletely();
  state.processingCommand = false;
  state.recorder = null;
  resetListeningState();
  state.waitingForRearm = true;
  state.awaitingHardwareMute = true;
  setMicState("Micro đã tự tắt", "idle");
  setMicVisualState("idle");

  setFeedback(message);
}

function startMonitoring() {
  if (!state.analyser || state.monitoringFrame) {
    return;
  }

  const buffer = new Float32Array(state.analyser.fftSize);

  const loop = () => {
    if (!state.recorder || !state.analyser) {
      state.monitoringFrame = null;
      return;
    }

    state.analyser.getFloatTimeDomainData(buffer);
    let energy = 0;
    for (let index = 0; index < buffer.length; index += 1) {
      energy += buffer[index] * buffer[index];
    }

    const rms = Math.sqrt(energy / buffer.length);
    const now = performance.now();

    if (rms > 0.035) {
      if (!state.speechDetected) {
        state.speechDetected = true;
        state.speakingStartedAt = now;
        setMicState("Đang nghe lệnh", "active");
        setMicVisualState("listening");
        setFeedback("Đã phát hiện giọng nói. Hệ thống đang nghe một lệnh duy nhất.");
      }
      state.silenceStartedAt = 0;
    } else if (state.speechDetected) {
      if (!state.silenceStartedAt) {
        state.silenceStartedAt = now;
      }
      if (now - state.silenceStartedAt > 850) {
        stopCurrentSegment("Đã ghi xong lệnh.");
        state.monitoringFrame = null;
        return;
      }
    }

    if (!state.speechDetected && now - state.segmentStartedAt > 8000) {
      stopCurrentSegment("Không nghe thấy lệnh rõ ràng.");
      state.monitoringFrame = null;
      return;
    }

    if (state.speechDetected && state.speakingStartedAt && now - state.speakingStartedAt > 5000) {
      stopCurrentSegment("Đã ghi xong lệnh.");
      state.monitoringFrame = null;
      return;
    }

    state.monitoringFrame = requestAnimationFrame(loop);
  };

  state.monitoringFrame = requestAnimationFrame(loop);
}

function stopCurrentSegment(message = "") {
  state.pendingMessage = message;
  if (state.recorder && state.recorder.state !== "inactive") {
    state.recorder.stop();
  } else {
    void shutdownMicrophoneSession(message || "Micro đã dừng.");
  }
}

function createAudioGraph() {
  state.audioContext = new AudioContext();
  state.sourceNode = state.audioContext.createMediaStreamSource(state.stream);
  state.analyser = state.audioContext.createAnalyser();
  state.analyser.fftSize = 2048;
  state.sourceNode.connect(state.analyser);
}

function canStartListening() {
  return Boolean(
    state.stream &&
      state.track &&
      state.track.readyState === "live" &&
      state.backendMicMuted !== true &&
      !state.processingCommand &&
      !state.recorder
  );
}

function registerTrackEvents(streamTrack, sessionId) {
  streamTrack.onmute = () => {
    if (sessionId !== state.sessionId) {
      return;
    }
    setMicState("Micro đang tắt", "idle");
    setMicVisualState("idle");
    if (state.waitingForRearm) {
      state.awaitingHardwareMute = false;
      setFeedback("Đã nhận thao tác tắt micro từ tai nghe. Hãy bật lại một lần để tiếp tục.");
    }
  };

  streamTrack.onunmute = () => {
    if (sessionId !== state.sessionId || state.processingCommand) {
      return;
    }
    setMicState("Micro đã bật", "active");
    setMicVisualState("armed");
    if (state.waitingForRearm && !state.rearming) {
      setFeedback("Đã nhận thao tác bật micro. Hệ thống đang gài lại phiên nghe.");
      void rearmListeningAfterMicEnabled();
    }
  };

  streamTrack.onended = async () => {
    if (sessionId !== state.sessionId) {
      return;
    }
    await releaseStreamCompletely();
    setMicState("Micro đã bị ngắt", "error");
    setMicVisualState("blocked");
    setFeedback(
      "Kết nối micro đã bị ngắt. Hãy bật lại micro từ trình duyệt hoặc thiết bị để kết nối lại."
    );
  };
}

async function startOneShotListening() {
  if (!canStartListening()) {
    return;
  }

  if (!state.audioContext || state.audioContext.state === "closed" || !state.analyser) {
    createAudioGraph();
  }

  const currentSessionId = state.sessionId;
  const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "";
  state.recorder = mimeType
    ? new MediaRecorder(state.stream, { mimeType })
    : new MediaRecorder(state.stream);

  resetListeningState();
  state.segmentStartedAt = performance.now();
  state.waitingForRearm = false;

  state.recorder.addEventListener("dataavailable", (event) => {
    if (event.data && event.data.size > 0) {
      state.recordedChunks.push(event.data);
    }
  });

  state.recorder.addEventListener("stop", async () => {
    if (currentSessionId !== state.sessionId) {
      return;
    }

    const chunks = [...state.recordedChunks];
    const speechDetected = state.speechDetected;
    const pendingMessage = state.pendingMessage;
    state.recorder = null;

    if (state.track?.muted) {
      await suspendListeningSession(pendingMessage || "Micro đã bị tắt.");
      return;
    }

    if (!chunks.length || !speechDetected) {
      await suspendListeningSession(
        pendingMessage || "Chưa nhận được lệnh rõ ràng. Hãy tắt rồi bật lại micro để ghi lại."
      );
      return;
    }

    await processRecordedAudio(chunks);
  });

  state.recorder.start();
  setMicState("Đang chờ giọng nói", "active");
  setMicVisualState("armed");
  setFeedback("Micro đã sẵn sàng. Hãy nói rõ một lệnh duy nhất.");
  startMonitoring();
}

async function connectMicrophone() {
  if (state.stream || state.processingCommand || state.connectInProgress) {
    return;
  }

  try {
    state.connectInProgress = true;
    setMicState("Đang kết nối micro", "idle");
    setMicVisualState("armed");
    state.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        noiseSuppression: true,
        echoCancellation: true,
      },
    });

    state.sessionId += 1;
    state.track = state.stream.getAudioTracks()[0] || null;
    state.hasMicAccess = Boolean(state.track);
    createAudioGraph();

    if (!state.track) {
      throw new Error("Không tìm thấy thiết bị micro.");
    }

    registerTrackEvents(state.track, state.sessionId);
    const micShouldBeActive = state.backendMicMuted === false;
    setMicState(micShouldBeActive ? "Micro đã bật" : "Micro đang tắt", micShouldBeActive ? "active" : "idle");
    setMicVisualState(micShouldBeActive ? "armed" : "idle");
    setFeedback(
      micShouldBeActive
        ? 'Micro đã sẵn sàng. Hãy nói "go" để kích hoạt, sau đó tắt và bật lại micro cho từng lệnh.'
        : "Micro đang tắt từ trình duyệt hoặc thiết bị. Khi bật lại, hệ thống sẽ tự ghi lệnh."
    );

    if (micShouldBeActive) {
      await startOneShotListening();
    }
  } catch (error) {
    await releaseStreamCompletely();
    setMicState("Không truy cập được micro", "error");
    setMicVisualState("blocked");
    setFeedback(
      "Không thể kết nối micro. Hãy kiểm tra quyền micro trên trình duyệt và thiết bị, rồi thử lại."
    );
  } finally {
    state.connectInProgress = false;
  }
}

async function refreshMicrophoneState() {
  if (state.permissionState === "denied") {
    updatePermissionFeedback();
    return;
  }

  if (!state.stream) {
    await connectMicrophone();
    return;
  }

  if (state.track && state.track.readyState === "ended") {
    await releaseStreamCompletely();
    await connectMicrophone();
    return;
  }
}

async function watchPermission() {
  if (!navigator.permissions?.query) {
    await connectMicrophone();
    return;
  }

  try {
    const permissionStatus = await navigator.permissions.query({ name: "microphone" });
    state.permissionStatus = permissionStatus;
    state.permissionState = permissionStatus.state;

    permissionStatus.onchange = async () => {
      state.permissionState = permissionStatus.state;

      if (permissionStatus.state === "denied") {
        await releaseStreamCompletely();
        updatePermissionFeedback();
        return;
      }

      await refreshMicrophoneState();
    };
  } catch (error) {
    state.permissionState = "prompt";
  }

  await refreshMicrophoneState();
}

function handleTrackFiles(files) {
  const tracks = Array.from(files).map((file, index) => {
    const url = URL.createObjectURL(file);
    state.objectUrls.push(url);
    return {
      id: `upload-${Date.now()}-${index}`,
      title: file.name.replace(/\.[^/.]+$/, ""),
      artist: "Nhạc tải lên",
      url,
    };
  });

  mergeTracks(tracks);
  setFeedback(`Đã nạp ${tracks.length} bài hát từ máy.`);
}

function bindEvents() {
  elements.playButton.addEventListener("click", playTrack);
  elements.playToggleButton.addEventListener("click", togglePlayPause);
  elements.stopButton.addEventListener("click", stopTrack);
  elements.nextButton.addEventListener("click", nextTrack);
  elements.backButton.addEventListener("click", backTrack);
  elements.replayButton.addEventListener("click", replayTrack);
  elements.trackInput.addEventListener("change", (event) => {
    handleTrackFiles(event.target.files);
    event.target.value = "";
  });
  elements.audio.addEventListener("ended", nextTrack);
  elements.audio.addEventListener("play", syncPlayButton);
  elements.audio.addEventListener("pause", syncPlayButton);

  window.addEventListener("focus", () => {
    void refreshMicrophoneState();
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      void refreshMicrophoneState();
    }
  });
  if (navigator.mediaDevices?.addEventListener) {
    navigator.mediaDevices.addEventListener("devicechange", () => {
      void refreshMicrophoneState();
    });
  }
}

function startMicrophonePolling() {
  if (state.micPollTimer) {
    return;
  }

  state.micPollTimer = window.setInterval(() => {
    void pollMicrophoneState();
  }, 200);
}

async function init() {
  setActivationState(false);
  setMicState("Đang chờ micro", "idle");
  setMicVisualState("idle");
  elements.lastCommand.textContent = "Chưa có";
  updateCommandCount();
  bindEvents();
  renderPlaylist();
  syncPlayButton();

  try {
    await loadServerPlaylist();
  } catch (error) {
    setFeedback("Không tải được danh sách phát mặc định. Bạn vẫn có thể nạp nhạc từ máy.");
  }

  startMicrophonePolling();
  await pollMicrophoneState();
  await watchPermission();
}

window.addEventListener("beforeunload", () => {
  state.objectUrls.forEach((url) => URL.revokeObjectURL(url));
  if (state.micPollTimer) {
    window.clearInterval(state.micPollTimer);
  }
  void releaseStreamCompletely();
});

void init();
