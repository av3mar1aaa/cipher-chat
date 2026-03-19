import useStore from '../store/useStore';

export default function UserAvatar({
  name,
  avatarUrl,
  userId,
  size = 40,
  online,
  showStatus = true,
}) {
  const onlineUsers = useStore((s) => s.onlineUsers);
  const isOnline = online !== undefined ? online : onlineUsers.has(userId);

  const initial = (name || '?').charAt(0).toUpperCase();

  const colors = [
    '#00ff41',
    '#00cc33',
    '#33ff77',
    '#00ff88',
    '#11dd55',
    '#22ee44',
  ];
  const colorIndex =
    (name || '').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) %
    colors.length;

  return (
    <div
      className={`user-avatar ${isOnline && showStatus ? 'user-avatar--online' : ''}`}
      style={{
        width: size,
        height: size,
        minWidth: size,
        fontSize: size * 0.4,
      }}
    >
      {avatarUrl ? (
        <img src={avatarUrl} alt={name} className="user-avatar__img" />
      ) : (
        <div
          className="user-avatar__initial"
          style={{
            backgroundColor: `${colors[colorIndex]}15`,
            color: colors[colorIndex],
            borderColor: isOnline && showStatus ? colors[colorIndex] : '#333',
          }}
        >
          {initial}
        </div>
      )}
      {isOnline && showStatus && <div className="user-avatar__status" />}
    </div>
  );
}
