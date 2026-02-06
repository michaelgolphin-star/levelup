/* ---- Counselor’s Office helpers (append at bottom) ---- */

.grid2 {
  display: grid;
  grid-template-columns: 1fr;
  gap: 14px;
}
@media (min-width: 900px) {
  .grid2 {
    grid-template-columns: 1fr 1fr;
  }
}

.panel {
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 16px;
  padding: 14px;
  background: rgba(255, 255, 255, 0.04);
}

.panelTitle {
  font-weight: 800;
  letter-spacing: 0.2px;
}

.list {
  display: grid;
  gap: 10px;
  margin-top: 10px;
}

.listItem {
  text-align: left;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 14px;
  padding: 12px;
  background: rgba(0, 0, 0, 0.20);
  cursor: pointer;
}
.listItem:hover {
  background: rgba(255, 255, 255, 0.06);
}
.listItemStatic {
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 14px;
  padding: 12px;
  background: rgba(0, 0, 0, 0.20);
}

.listTop {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: flex-start;
}

.listTitle {
  font-weight: 800;
}

.chips {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.chip {
  font-size: 12px;
  padding: 4px 8px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.06);
}
.chip.danger {
  border-color: rgba(251, 113, 133, 0.45);
  background: rgba(251, 113, 133, 0.12);
}

.chatBox {
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 16px;
  background: rgba(0, 0, 0, 0.20);
  padding: 12px;
  max-height: 420px;
  overflow: auto;
}

.chatList {
  display: grid;
  gap: 10px;
  margin-top: 10px;
}

.bubble {
  border-radius: 14px;
  padding: 10px 12px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.06);
}

.bubble.user {
  background: rgba(34, 197, 94, 0.10);
  border-color: rgba(34, 197, 94, 0.25);
}

.bubble.ai {
  background: rgba(59, 130, 246, 0.10);
  border-color: rgba(59, 130, 246, 0.25);
}

.bubbleMeta {
  font-size: 12px;
  opacity: 0.8;
  margin-bottom: 6px;
}

.bubbleText {
  white-space: pre-wrap;
  line-height: 1.35;
}
