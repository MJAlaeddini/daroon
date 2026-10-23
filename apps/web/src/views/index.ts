import { vArchive } from './archive';
import { vExplore } from './explore';
import { vGuide } from './guide';
import { vLogin } from './login';
import { vPatterns } from './patterns';
import { vReflect } from './reflect';
import { vToday } from './today';

export const VIEWS = {
  login: vLogin,
  today: vToday,
  explore: vExplore,
  guide: vGuide,
  reflect: vReflect,
  archive: vArchive,
  patterns: vPatterns,
};
