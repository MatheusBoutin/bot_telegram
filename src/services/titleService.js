function getTitle(level) {
  if (level >= 50) {
    return "Sábio da Biblioteca";
  }

  if (level >= 45) {
    return "Grão-Mestre do Acervo";
  }

  if (level >= 40) {
    return "Arquimago";
  }

  if (level >= 35) {
    return "Mestre Arcano";
  }

  if (level >= 30) {
    return "Guardião do Tomo";
  }

  if (level >= 25) {
    return "Magíster";
  }

  if (level >= 20) {
    return "Erudito";
  }

  if (level >= 15) {
    return "Escriba Arcano";
  }

  if (level >= 10) {
    return "Adepto";
  }

  if (level >= 5) {
    return "Iniciado";
  }

  return "Aprendiz";
}

module.exports = {
  getTitle,
};
