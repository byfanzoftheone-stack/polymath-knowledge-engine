import { useEffect, useMemo, useState } from 'react';
import { listLessons, listSessions, startSession, submitRelayCommand } from './api';
import { useLiveRelay } from './useLiveRelay';

export default function App() {
  const [lessons, setLessons] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [selectedLessonId, setSelectedLessonId] = useState('');
  const [activeSession, setActiveSession] = useState(null);
  const [command, setCommand] = useState('node -v');
  const [responsePayload, setResponsePayload] = useState('Ready.');

  const liveEvents = useLiveRelay(activeSession?.id);

  useEffect(() => {
    void refreshData();
  }, []);

  useEffect(() => {
    if (liveEvents.length > 0) {
      setResponsePayload(JSON.stringify(liveEvents[liveEvents.length - 1], null, 2));
    }
  }, [liveEvents]);

  async function refreshData() {
    const [lessonData, sessionData] = await Promise.all([listLessons(), listSessions()]);
    setLessons(lessonData.lessons || []);
    setSessions(sessionData.sessions || []);

    if (!selectedLessonId && lessonData.lessons?.length) {
      setSelectedLessonId(lessonData.lessons[0].id);
    }
  }

  async function handleStartSession() {
    if (!selectedLessonId) {
      setResponsePayload('No lesson available to start. Seed data first.');
      return;
    }

    const result = await startSession({ lessonId: selectedLessonId });
    setActiveSession(result.session || null);
    setResponsePayload(JSON.stringify(result, null, 2));
    await refreshData();
  }

  async function handleSendCommand() {
    if (!activeSession?.id) {
      setResponsePayload('Start a session first.');
      return;
    }

    const result = await submitRelayCommand({ sessionId: activeSession.id, command });
    setResponsePayload(JSON.stringify(result, null, 2));
  }

  const activeLesson = useMemo(
    () => lessons.find((lesson) => lesson.id === selectedLessonId),
    [lessons, selectedLessonId]
  );

  return (
    <main className="app">
      <h1>Polymath Knowledge Engine</h1>
      <p>{activeLesson?.description || 'Select a lesson to begin.'}</p>

      <section className="card">
        <label htmlFor="lesson">Lesson</label>
        <select id="lesson" value={selectedLessonId} onChange={(event) => setSelectedLessonId(event.target.value)}>
          {lessons.map((lesson) => (
            <option key={lesson.id} value={lesson.id}>
              {lesson.title}
            </option>
          ))}
        </select>

        <button onClick={handleStartSession}>Start Session</button>
      </section>

      <section className="card">
        <label htmlFor="command">Command</label>
        <textarea id="command" value={command} onChange={(event) => setCommand(event.target.value)} />
        <button onClick={handleSendCommand}>Send Command</button>
      </section>

      <section className="card">
        <h2>Response / Live Event</h2>
        <pre>{responsePayload}</pre>
      </section>

      <section className="card">
        <h2>Sessions</h2>
        <pre>{JSON.stringify(sessions, null, 2)}</pre>
      </section>
    </main>
  );
}
