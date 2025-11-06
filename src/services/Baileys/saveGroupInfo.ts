import axios from 'axios';
import groupStore from './groupStore';

interface SaveGroupInfoParams {
  sessionId: string;
  groupId: string;
  groupName: string;
  lastMessageAt?: Date;
}

interface CachedGroupInfo {
  groupName: string;
  lastMessageAt?: string;
}

const reportedGroups = new Map<string, CachedGroupInfo>();
let missingUrlLogged = false;

const getCacheKey = (sessionId: string, groupId: string): string =>
  `${sessionId}:${groupId}`;

export const saveGroupInfo = async ({
  sessionId,
  groupId,
  groupName,
  lastMessageAt,
}: SaveGroupInfoParams): Promise<void> => {
  const fallbackDate = lastMessageAt ?? new Date();
  groupStore.upsertGroup({
    sessionId,
    groupId,
    groupName: groupName.trim(),
    lastMessageAt: fallbackDate,
  });

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

  const cacheKey = getCacheKey(sessionId, groupId);
  const cached = reportedGroups.get(cacheKey);

  const normalizedGroupName = groupName.trim();
  const normalizedLastMessageAt = fallbackDate.toISOString();

  if (
    cached &&
    cached.groupName === normalizedGroupName &&
    cached.lastMessageAt === normalizedLastMessageAt
  ) {
    return;
  }

  await axios.post(url, {
    sessionId,
    groupId,
    groupName: normalizedGroupName,
    lastMessageAt: normalizedLastMessageAt,
  });

  reportedGroups.set(cacheKey, {
    groupName: normalizedGroupName,
    lastMessageAt: normalizedLastMessageAt,
  });
};
