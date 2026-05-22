import curriculum from './data/curriculum.json'
import './style.css'

type CourseKind = 'obrigatoria' | 'optativa'
type CourseStatus = 'pending' | 'planned' | 'taking' | 'done'

type Course = {
  code: string
  name: string
  hours: number
  semester: number | null
  kind: CourseKind
}

type Curriculum = {
  source: {
    name: string
    url: string
    retrievedAt: string
  }
  program: {
    code: string
    name: string
    institution: string
    campus: string
    curriculum: string
    modality: string
    shift: string
    effectiveTerm: string
    minimumHours: number
    requiredElectiveHours: number
    requiredComplementaryHours: number
    semesters: number
  }
  semesters: Array<{
    number: number
    courseCodes: string[]
  }>
  courses: Course[]
}

type AppState = {
  query: string
  kind: 'all' | CourseKind
  status: 'all' | CourseStatus
  progress: Record<string, CourseStatus>
}

const typedCurriculum = curriculum as Curriculum
const storageKey = 'affix:progress:v1'
const statusOrder: CourseStatus[] = ['pending', 'planned', 'taking', 'done']
const statusLabels: Record<CourseStatus, string> = {
  pending: 'Pendente',
  planned: 'Planejada',
  taking: 'Cursando',
  done: 'Concluida',
}

const state: AppState = {
  query: '',
  kind: 'all',
  status: 'all',
  progress: loadProgress(),
}

const app = document.querySelector<HTMLDivElement>('#app')

if (!app) {
  throw new Error('App root not found')
}

const root = app

function loadProgress(): Record<string, CourseStatus> {
  const stored = localStorage.getItem(storageKey)
  if (!stored) {
    return {}
  }

  try {
    const parsed = JSON.parse(stored) as Record<string, CourseStatus>
    return Object.fromEntries(
      Object.entries(parsed).filter(([, value]) => statusOrder.includes(value)),
    )
  } catch {
    return {}
  }
}

function saveProgress() {
  localStorage.setItem(storageKey, JSON.stringify(state.progress))
}

function statusFor(code: string): CourseStatus {
  return state.progress[code] ?? 'pending'
}

function setStatus(code: string, status: CourseStatus) {
  if (status === 'pending') {
    delete state.progress[code]
  } else {
    state.progress[code] = status
  }
  saveProgress()
  render()
}

function nextStatus(code: string) {
  const current = statusFor(code)
  const next = statusOrder[(statusOrder.indexOf(current) + 1) % statusOrder.length]
  setStatus(code, next)
}

function normalized(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function filteredCourses(courses: Course[]) {
  const query = normalized(state.query)
  return courses.filter((course) => {
    const matchesQuery =
      query.length === 0 ||
      normalized(`${course.code} ${course.name}`).includes(query)
    const matchesKind = state.kind === 'all' || course.kind === state.kind
    const matchesStatus = state.status === 'all' || statusFor(course.code) === state.status
    return matchesQuery && matchesKind && matchesStatus
  })
}

function hours(courses: Course[], status?: CourseStatus) {
  return courses
    .filter((course) => (status ? statusFor(course.code) === status : true))
    .reduce((total, course) => total + course.hours, 0)
}

function percent(value: number, total: number) {
  if (total === 0) {
    return 0
  }
  return Math.min(100, Math.round((value / total) * 100))
}

function courseCard(course: Course) {
  const status = statusFor(course.code)
  const article = document.createElement('article')
  article.className = `course course-${status}`

  const header = document.createElement('div')
  header.className = 'course-header'

  const code = document.createElement('span')
  code.className = 'course-code'
  code.textContent = course.code

  const badge = document.createElement('button')
  badge.className = `status-badge status-${status}`
  badge.type = 'button'
  badge.textContent = statusLabels[status]
  badge.title = 'Alternar status'
  badge.addEventListener('click', () => nextStatus(course.code))

  header.append(code, badge)

  const title = document.createElement('h3')
  title.textContent = course.name

  const meta = document.createElement('div')
  meta.className = 'course-meta'
  meta.innerHTML = `<span>${course.hours}h</span><span>${course.kind}</span>`

  const actions = document.createElement('div')
  actions.className = 'course-actions'

  for (const option of statusOrder) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = option === status ? 'selected' : ''
    button.textContent = statusLabels[option]
    button.addEventListener('click', () => setStatus(course.code, option))
    actions.append(button)
  }

  article.append(header, title, meta, actions)
  return article
}

function progressPanel(label: string, value: number, total: number, detail: string) {
  const currentPercent = percent(value, total)
  return `
    <section class="metric">
      <div>
        <span>${label}</span>
        <strong>${value}h</strong>
      </div>
      <p>${detail}</p>
      <div class="progress-track" aria-hidden="true">
        <span style="width: ${currentPercent}%"></span>
      </div>
    </section>
  `
}

function render() {
  const requiredCourses = typedCurriculum.courses.filter((course) => course.kind === 'obrigatoria')
  const electiveCourses = typedCurriculum.courses.filter((course) => course.kind === 'optativa')
  const doneRequired = hours(requiredCourses, 'done')
  const doneElectives = hours(electiveCourses, 'done')
  const totalDone = hours(typedCurriculum.courses, 'done')
  const visibleCourses = filteredCourses(typedCurriculum.courses)

  root.innerHTML = `
    <header class="app-header">
      <div>
        <p class="eyebrow">${typedCurriculum.program.institution} / ${typedCurriculum.program.campus}</p>
        <h1>Affix</h1>
        <p class="subtitle">${typedCurriculum.program.name} - matriz ${typedCurriculum.program.curriculum}, ${typedCurriculum.program.modality}, ${typedCurriculum.program.shift.toLowerCase()}.</p>
      </div>
      <a class="source-link" href="${typedCurriculum.source.url}" target="_blank" rel="noreferrer">Fonte SIGAA</a>
    </header>

    <main>
      <section class="overview" aria-label="Resumo do curso">
        ${progressPanel('Obrigatorias', doneRequired, hours(requiredCourses), `${percent(doneRequired, hours(requiredCourses))}% de ${hours(requiredCourses)}h`)}
        ${progressPanel('Optativas', doneElectives, typedCurriculum.program.requiredElectiveHours, `minimo de ${typedCurriculum.program.requiredElectiveHours}h`)}
        ${progressPanel('Total registrado', totalDone, typedCurriculum.program.minimumHours, `meta curricular de ${typedCurriculum.program.minimumHours}h`)}
      </section>

      <section class="toolbar" aria-label="Filtros">
        <label class="search-field">
          <span>Buscar</span>
          <input id="search" type="search" value="${state.query}" placeholder="Codigo ou nome da disciplina">
        </label>
        <label>
          <span>Tipo</span>
          <select id="kind-filter">
            <option value="all">Todos</option>
            <option value="obrigatoria">Obrigatorias</option>
            <option value="optativa">Optativas</option>
          </select>
        </label>
        <label>
          <span>Status</span>
          <select id="status-filter">
            <option value="all">Todos</option>
            <option value="pending">Pendentes</option>
            <option value="planned">Planejadas</option>
            <option value="taking">Cursando</option>
            <option value="done">Concluidas</option>
          </select>
        </label>
        <button id="reset-progress" type="button">Limpar progresso</button>
      </section>

      <section class="semester-grid" aria-label="Disciplinas por nivel">
        ${typedCurriculum.semesters
          .map((semester) => {
            const courses = visibleCourses.filter((course) => course.semester === semester.number)
            return `
              <section class="semester">
                <div class="semester-title">
                  <h2>${semester.number}o nivel</h2>
                  <span>${hours(courses)}h visiveis</span>
                </div>
                <div class="course-list" data-semester="${semester.number}"></div>
              </section>
            `
          })
          .join('')}
      </section>

      <section class="semester electives">
        <div class="semester-title">
          <h2>Optativas</h2>
          <span>${filteredCourses(electiveCourses).length} disciplinas</span>
        </div>
        <div class="course-list" data-semester="electives"></div>
      </section>
    </main>
  `

  const search = document.querySelector<HTMLInputElement>('#search')
  const kindFilter = document.querySelector<HTMLSelectElement>('#kind-filter')
  const statusFilter = document.querySelector<HTMLSelectElement>('#status-filter')
  const reset = document.querySelector<HTMLButtonElement>('#reset-progress')

  if (search) {
    search.addEventListener('input', () => {
      state.query = search.value
      render()
    })
    search.focus()
    search.setSelectionRange(search.value.length, search.value.length)
  }

  if (kindFilter) {
    kindFilter.value = state.kind
    kindFilter.addEventListener('change', () => {
      state.kind = kindFilter.value as AppState['kind']
      render()
    })
  }

  if (statusFilter) {
    statusFilter.value = state.status
    statusFilter.addEventListener('change', () => {
      state.status = statusFilter.value as AppState['status']
      render()
    })
  }

  reset?.addEventListener('click', () => {
    state.progress = {}
    saveProgress()
    render()
  })

  for (const semester of typedCurriculum.semesters) {
    const container = document.querySelector<HTMLDivElement>(
      `.course-list[data-semester="${semester.number}"]`,
    )
    filteredCourses(typedCurriculum.courses)
      .filter((course) => course.semester === semester.number)
      .forEach((course) => container?.append(courseCard(course)))
  }

  const electives = document.querySelector<HTMLDivElement>('.course-list[data-semester="electives"]')
  filteredCourses(electiveCourses).forEach((course) => electives?.append(courseCard(course)))
}

render()
