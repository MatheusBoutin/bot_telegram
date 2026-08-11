const { User } = require("../database/models");

function getTelegramName(from) {
  const fullName = [from.first_name, from.last_name].filter(Boolean).join(" ");

  if (fullName) {
    return fullName;
  }

  if (from.username) {
    return from.username;
  }

  return `Usuário ${from.id}`;
}

async function getOrCreateUser(message) {
  const telegramId = String(message.from.id);
  const name = getTelegramName(message.from);
  const username = message.from.username || null;

  const [user, created] = await User.findOrCreate({
    where: {
      telegramId: telegramId,
    },

    defaults: {
      name: name,
      username: username,
    },
  });

  if (created) {
    console.log(`Novo usuário criado: ${user.name}`);
    return user;
  }

  let changed = false;

  if (user.name !== name) {
    user.name = name;
    changed = true;
  }

  if (user.username !== username) {
    user.username = username;
    changed = true;
  }

  if (changed) {
    await user.save();
  }

  return user;
}

module.exports = {
  getOrCreateUser,
};
