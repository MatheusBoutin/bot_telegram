const { ClubMember } = require("../database/models");
const { calculateLevel } = require("./xpService");

async function getOrCreateClubMember(user, club) {
  const [member, created] = await ClubMember.findOrCreate({
    where: {
      userId: user.id,
      clubId: club.id,
    },

    defaults: {
      xp: 0,
      level: 1,
      messageCount: 0,
      lastXpAt: 0,
      lastMessage: "",
      lastMessageAt: 0,
    },
  });

  if (created) {
    console.log(`${user.name} entrou no clube ${club.name}.`);
    return member;
  }

  const correctLevel = calculateLevel(member.xp);

  if (member.level !== correctLevel) {
    member.level = correctLevel;
    await member.save();
  }

  return member;
}

module.exports = {
  getOrCreateClubMember,
};
