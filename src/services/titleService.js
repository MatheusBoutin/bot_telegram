function getTitle(level) {
  if (level >= 41) {
    return "Ícone do Squad";
  }

  if (level >= 31) {
    return "Bibliotecário";
  }

  if (level >= 21) {
    return "Book Lover";
  }

  if (level >= 11) {
    return "Leitor Ativo";
  }

  return "Iniciante Literary";
}

function getUnlockedTitle(previousLevel, newLevel) {
  const previousTitle = getTitle(previousLevel);
  const newTitle = getTitle(newLevel);

  return previousTitle === newTitle ? null : newTitle;
}

module.exports = {
  getTitle,
  getUnlockedTitle,
};
