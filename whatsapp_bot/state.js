let aiEnabled = true; // default to enabled

function getAIEnabled() {
  return aiEnabled;
}

function setAIEnabled(value) {
  aiEnabled = Boolean(value);
}

module.exports = {
  getAIEnabled,
  setAIEnabled,
};
