// UCL, Bartlett, RC5
import { AuthApi, auth, db, FsApi } from "../firebase/firebaseClient.js";
if (window.lucide && typeof window.lucide.createIcons === "function") {
    window.lucide.createIcons();
}

const qs = new URLSearchParams(window.location.search);
const isPublic = qs.get("public") === "1";
const panelToolbar = document.querySelector(".panel.toolbar");
const panelSliders = document.querySelector(".panel.sliders");
const panelChat = document.querySelector(".panel.chat");

function togglePanel(el) {
    if (!el) return;
    el.classList.toggle("hidden");
}

const btnToggleToolbar = document.getElementById("btnToggleToolbar");
const btnToggleParams = document.getElementById("btnToggleParams");
const btnToggleChat = document.getElementById("btnToggleChat");

if (btnToggleToolbar) btnToggleToolbar.onclick = () => togglePanel(panelToolbar);
if (btnToggleParams) btnToggleParams.onclick = () => togglePanel(panelSliders);
if (btnToggleChat) btnToggleChat.onclick = () => togglePanel(panelChat);

window.addEventListener("keydown", (e) => {
    if (e.target && (e.target.tagName === "TEXTAREA" || e.target.tagName === "INPUT")) return;
    if (e.key === "1") togglePanel(panelToolbar);
    if (e.key === "2") togglePanel(panelSliders);
    if (e.key === "3") togglePanel(panelChat);
});

const room = qs.get("room");

const btnBack = document.getElementById("btnBack");
if (btnBack) {
    btnBack.onclick = () => {
        window.location.href = isPublic ? "../index.html" : "../library/library.html";
    };
}

async function ensureSpaceExists(uid, roomKey) {
    const ref = FsApi.doc(db, "users", uid, "spaces", roomKey);
    const snap = await FsApi.getDoc(ref);
    return snap.exists();
}

AuthApi.onAuthStateChanged(auth, async (user) => {
    if (!room) {
        window.location.replace(isPublic ? "../index.html" : "../library/library.html");
        return;
    }

    if (isPublic) {
        if (!user) {
            try {
                await AuthApi.signInAnonymously();
            } catch (e) {
                console.warn("Anonymous sign-in failed:", e?.message || e);
            }
        }
        await import("./three.js");
        return;
    }
    if (!user) {
        window.location.replace("../index.html");
        return;
    }

    const ok = await ensureSpaceExists(user.uid, room);
    if (!ok) {
        window.location.replace("../library/library.html");
        return;
    }

    await import("./three.js");
});
