import React, { useState } from 'react';
import { Box, Button, Chip, Avatar, Tooltip } from '@mui/material';
import { styled } from '@mui/material/styles';
import {
  Home as HomeIcon,
  School as SchoolIcon,
  Quiz as QuizIcon,
  Logout as LogoutIcon,
  Person as PersonIcon,
} from '@mui/icons-material';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';

interface SidebarProps {
  userName?: string;
  subscriptionLabel?: string;
}

const SidebarContainer = styled(Box)(({ theme }) => ({
  position: 'fixed',
  top: 0,
  left: 0,
  height: '100vh',
  padding: theme.spacing(2),
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(1),
  zIndex: 1200,
  borderRight: `1px solid ${theme.palette.divider}`,
  background: theme.palette.background.paper,
  borderTopRightRadius: 16,
  borderBottomRightRadius: 16,
  width: 72,
  transition: 'width 200ms ease',
  overflow: 'hidden',
}));

const Row = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  minHeight: 48,
}));

const NavButton = styled(Button)(({ theme }) => ({
  justifyContent: 'flex-start',
  paddingLeft: theme.spacing(1),
  paddingRight: theme.spacing(1),
  borderRadius: 12,
  textTransform: 'none',
  overflow: 'hidden',
  minHeight: 40,
}));

const Sidebar: React.FC<SidebarProps> = ({ userName, subscriptionLabel }) => {
  const [expanded, setExpanded] = useState(false);

  const handleMouseEnter = () => setExpanded(true);
  const handleMouseLeave = () => setExpanded(false);

  return (
    <SidebarContainer
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      sx={{ width: expanded ? 240 : 72 }}
    >
      <Row>
        <Avatar sx={{ bgcolor: 'primary.main', width: 36, height: 36 }}>
          <PersonIcon />
        </Avatar>
        {expanded && (
          <Box sx={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
            <Box sx={{ fontWeight: 600 }}>{userName || 'User'}</Box>
            <Chip size="small" label={subscriptionLabel || 'FREE'} sx={{ height: 20, mt: 0.5 }} />
          </Box>
        )}
      </Row>

      <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        <Tooltip title="Homepage" placement="right">
          <NavButton href="/" startIcon={<HomeIcon />}>
            {expanded && 'Homepage'}
          </NavButton>
        </Tooltip>
        <Tooltip title="Profile" placement="right">
          <NavButton href="#" startIcon={<PersonIcon />}>
            {expanded && 'Profile'}
          </NavButton>
        </Tooltip>
        <Tooltip title="AI Tutor" placement="right">
          <NavButton href="/tutor" startIcon={<SchoolIcon />}>
            {expanded && 'AI Tutor'}
          </NavButton>
        </Tooltip>
        <Tooltip title="Take Quiz" placement="right">
          <NavButton href="/quiz" startIcon={<QuizIcon />}>
            {expanded && 'Take Quiz'}
          </NavButton>
        </Tooltip>
        <Tooltip title="Logout" placement="right">
          <NavButton
            onClick={() => signOut(auth)}
            color="error"
            startIcon={<LogoutIcon />}
          >
            {expanded && 'Logout'}
          </NavButton>
        </Tooltip>
      </Box>
    </SidebarContainer>
  );
};

export default Sidebar;
