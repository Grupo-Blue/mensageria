import axios from 'axios';

const reportedGroups = new Map<string, string>();
let missingUrlLogged = false;

export const saveGroupInfo = async (
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

  const cachedName = reportedGroups.get(groupId);
  if (cachedName === groupName) {
    return;
  }

  await axios.post(url, {
    groupId,
    groupName,
  });

  reportedGroups.set(groupId, groupName);
};
