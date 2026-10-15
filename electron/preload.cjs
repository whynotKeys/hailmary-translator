const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktopAPI", {
  getSounds: () => ipcRenderer.invoke("sound:list"),

  saveSound: (data) => ipcRenderer.invoke("sound:save", data),

  readSound: (id) => ipcRenderer.invoke("sound:read", id),

  deleteSound: (id) => ipcRenderer.invoke("sound:delete", id),

  updateSound: (id, korean) =>
    ipcRenderer.invoke("sound:update", { id, korean }),
});
