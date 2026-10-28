import { Link } from 'react-router-dom';
import { Page } from '../components/ui';

const LINKS = [
  { to: '/importar', title: 'Importar treinos', desc: 'Prints do box, fotos, texto, entrada manual, CSV' },
  { to: '/calendario', title: 'Calendário', desc: 'Box, plano, realizado, descanso e eventos oficiais' },
  { to: '/biblioteca', title: 'Biblioteca de exercícios', desc: 'Instruções, scaling e animações' },
  { to: '/equipamentos', title: 'Equipamentos', desc: 'Inventário do home gym (confirmar itens)' },
  { to: '/fontes', title: 'Fontes oficiais CrossFit', desc: 'WOD oficial, calendário e metodologia' },
  { to: '/dados', title: 'Dados & privacidade', desc: 'Perfil, exportação, backup, apagar' },
];

export default function More() {
  return (
    <Page title="Mais">
      {LINKS.map((l) => (
        <Link key={l.to} to={l.to} className="card-tight flex items-center justify-between">
          <div><div className="font-semibold text-bone-50">{l.title}</div><div className="text-xs text-bone-400">{l.desc}</div></div><span className="text-petrol-300">›</span>
        </Link>
      ))}
      <p className="px-1 text-xs leading-relaxed text-bone-400">
        CG Performance é um app pessoal, <b>não oficial e não afiliado à CrossFit, LLC</b>. CrossFit é marca registrada de seus titulares.
        As recomendações são heurísticas de treino e não substituem avaliação médica, prescrição ou orientação de coach presencial.
      </p>
    </Page>
  );
}
