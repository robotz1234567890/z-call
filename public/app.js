const socket = io();
const joinScreen = document.getElementById("join-screen");
const callScreen = document.getElementById("call-screen");
const nameInput = document.getElementById("name-input");
const joinBtn = document.getElementById("join-btn");
const joinError = document.getElementById("join-error");
const videoGrid = document.getElementById("video-grid");
const countEl = document.getElementById("participant-count");
const messages = document.getElementById("messages");
const chatForm = document.getElementById("chat-form");
const chatInput = document.getElementById("chat-input");
const muteBtn = document.getElementById("mute-btn");
const cameraBtn = document.getElementById("camera-btn");
const screenBtn = document.getElementById("screen-btn");
const leaveBtn = document.getElementById("leave-btn");
const copyLink = document.getElementById("copy-link");

let myName = "";
let localStream = null;
let peers = new Map();
let screenStream = null;

const rtcConfig = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

function addVideo(id, name, stream, local = false) {
  let card = document.getElementById("card-" + id);
  if (!card) {
    card = document.createElement("div");
    card.className = "video-card";
    card.id = "card-" + id;
    const video = document.createElement("video");
    video.autoplay = true;
    video.playsInline = true;
    if (local) video.muted = true;
    const label = document.createElement("div");
    label.className = "video-label";
    label.textContent = name + (local ? " (You)" : "");
    card.append(video, label);
    videoGrid.appendChild(card);
  }
  const video = card.querySelector("video");
  if (video.srcObject !== stream) video.srcObject = stream;
}

function removeVideo(id) {
  document.getElementById("card-" + id)?.remove();
}

function makePeer(id, name, initiator) {
  if (peers.has(id)) return peers.get(id);
  const pc = new RTCPeerConnection(rtcConfig);
  peers.set(id, pc);
  localStream.getTracks().forEach(t => pc.addTrack(t, localStream));

  pc.onicecandidate = e => {
    if (e.candidate) socket.emit("ice-candidate", { to: id, candidate: e.candidate });
  };
  pc.ontrack = e => addVideo(id, name, e.streams[0]);
  pc.onconnectionstatechange = () => {
    if (["failed","closed","disconnected"].includes(pc.connectionState)) {
      pc.close(); peers.delete(id); removeVideo(id);
    }
  };

  if (initiator) {
    pc.createOffer().then(offer => pc.setLocalDescription(offer))
      .then(() => socket.emit("offer", { to: id, offer: pc.localDescription }));
  }
  return pc;
}

joinBtn.onclick = async () => {
  myName = nameInput.value.trim().slice(0, 32);
  if (!myName) { joinError.textContent = "Enter your name first."; return; }
  joinBtn.disabled = true;
  joinError.textContent = "";
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    addVideo("local", myName, localStream, true);
    joinScreen.classList.add("hidden");
    callScreen.classList.remove("hidden");
    socket.emit("join-call", { name: myName });
  } catch (err) {
    joinBtn.disabled = false;
    joinError.textContent = "Camera/microphone permission is required to join.";
  }
};

nameInput.addEventListener("keydown", e => { if (e.key === "Enter") joinBtn.click(); });

socket.on("existing-users", users => {
  users.forEach(u => makePeer(u.id, u.name, true));
  countEl.textContent = users.length + 1;
});

socket.on("user-joined", u => {
  makePeer(u.id, u.name, true);
  countEl.textContent = Number(countEl.textContent) + 1;
});

socket.on("offer", async ({ from, offer }) => {
  const pc = makePeer(from, "Guest", false);
  await pc.setRemoteDescription(offer);
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  socket.emit("answer", { to: from, answer: pc.localDescription });
});

socket.on("answer", async ({ from, answer }) => {
  const pc = peers.get(from);
  if (pc) await pc.setRemoteDescription(answer);
});

socket.on("ice-candidate", async ({ from, candidate }) => {
  const pc = peers.get(from);
  if (pc && candidate) {
    try { await pc.addIceCandidate(candidate); } catch {}
  }
});

socket.on("user-left", ({ id }) => {
  const pc = peers.get(id);
  if (pc) pc.close();
  peers.delete(id);
  removeVideo(id);
});

socket.on("participant-count", n => countEl.textContent = n);

chatForm.onsubmit = e => {
  e.preventDefault();
  const text = chatInput.value.trim();
  if (!text) return;
  socket.emit("chat-message", { text });
  chatInput.value = "";
};

socket.on("chat-message", ({ name, text }) => {
  const item = document.createElement("div");
  item.className = "message";
  const b = document.createElement("b");
  b.textContent = name;
  const p = document.createElement("p");
  p.textContent = text;
  item.append(b, p);
  messages.appendChild(item);
  messages.scrollTop = messages.scrollHeight;
});

muteBtn.onclick = () => {
  const track = localStream?.getAudioTracks()[0];
  if (!track) return;
  track.enabled = !track.enabled;
  muteBtn.querySelector("span").textContent = track.enabled ? "Mute" : "Unmute";
};

cameraBtn.onclick = () => {
  const track = localStream?.getVideoTracks()[0];
  if (!track) return;
  track.enabled = !track.enabled;
  cameraBtn.querySelector("span").textContent = track.enabled ? "Camera" : "Camera off";
};

screenBtn.onclick = async () => {
  if (screenStream) {
    screenStream.getTracks().forEach(t => t.stop());
    screenStream = null;
    screenBtn.querySelector("span").textContent = "Share screen";
    return;
  }
  try {
    screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
    const screenTrack = screenStream.getVideoTracks()[0];
    for (const pc of peers.values()) {
      const sender = pc.getSenders().find(s => s.track?.kind === "video");
      if (sender) await sender.replaceTrack(screenTrack);
    }
    screenTrack.onended = () => {
      const cameraTrack = localStream.getVideoTracks()[0];
      for (const pc of peers.values()) {
        const sender = pc.getSenders().find(s => s.track?.kind === "video");
        if (sender) sender.replaceTrack(cameraTrack);
      }
      screenStream = null;
      screenBtn.querySelector("span").textContent = "Share screen";
    };
    screenBtn.querySelector("span").textContent = "Stop sharing";
  } catch {}
};

copyLink.onclick = async () => {
  await navigator.clipboard.writeText(location.href);
  copyLink.textContent = "Copied!";
  setTimeout(() => copyLink.textContent = "Copy invite link", 1500);
};

leaveBtn.onclick = () => {
  localStream?.getTracks().forEach(t => t.stop());
  screenStream?.getTracks().forEach(t => t.stop());
  peers.forEach(pc => pc.close());
  location.reload();
};