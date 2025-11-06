import axios from 'axios';

const reportedGroups = new Map<string, string>();
const sessionGroupKey = (sessionId: string, groupId: string) => `${sessionId}:${groupId}`;
let missingUrlLogged = false;

export const saveGroupInfo = async (
  sessionId: string,
  groupId: string,
  groupName: string,
): Promise<void> => {
  const url = process.env.WHATSAPP_GROUPS_CALLBACK_URL;

  if (!url) {
    if (!missingUrlLogged) {
      console.warn(
        'WHATSAPP_GROUPS_CALLBACK_URL não configurada. Informações de grupos não serão persistidas.',
      );
      missingUrlLogged = true;
    }
    return;
  }

  const cacheKey = sessionGroupKey(sessionId, groupId);
  const cachedName = reportedGroups.get(cacheKey);
  if (cachedName === groupName) {
    return;
  }

  await axios.post(url, {
    sessionId,
    groupId,
    groupName,
    timestamp: new Date().toISOString(),
  });

  reportedGroups.set(cacheKey, groupName);
};
