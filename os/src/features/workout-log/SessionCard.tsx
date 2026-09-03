import { useState } from 'react'
import type { Exercise, FieldType } from '../exercises'
import type { NewExerciseEntry, WorkoutEntry, WorkoutSession } from './types'
import { formatSet } from './formatSet'
import { SessionForm } from './SessionForm'
import { ExerciseEntryForm } from './ExerciseEntryForm'
import { WorkoutTimer } from './WorkoutTimer'
import { dayLabel } from '../../shared/localDate'
import { formatVolume } from '../../shared/units'
import { useUnits } from '../../shared/unitsContext'
import { formatDuration, sessionDurationSeconds, sessionVolume } from './sessionStats'

interface SessionCardProps { session:WorkoutSession; entries:WorkoutEntry[]; isOpen:boolean; exercises:Exercise[]; fieldTypes:FieldType[]; historyFieldTypes:FieldType[]; getLastEntry:(exerciseId:string)=>WorkoutEntry|undefined; onToggle:()=>void; onUpdateSession:(date:string,name:string,durationSeconds?:number)=>boolean; onFinishSession?:()=>boolean; onDeleteSession?:()=>boolean; onAddEntry:(entry:NewExerciseEntry)=>boolean; onUpdateEntry:(entryId:string,entry:NewExerciseEntry)=>boolean; onDeleteEntry?:(entryId:string)=>boolean }

export function SessionCard({ session, entries, isOpen, exercises, fieldTypes, historyFieldTypes, getLastEntry, onToggle, onUpdateSession, onFinishSession, onDeleteSession, onAddEntry, onUpdateEntry, onDeleteEntry }: SessionCardProps) {
  const [editing,setEditing]=useState(false)
  const [editingEntryId,setEditingEntryId]=useState('')
  /*
   * A finished session keeps its form behind a button. You come back to an old
   * workout to read it, not to write in it — but "I forgot to log the last
   * exercise" is real, and until now the only way in was to delete the session
   * and type it again.
   */
  const [addingEntry,setAddingEntry]=useState(false)
  const { system }=useUnits()
  const active=!session.endedAt
  const completedSets=entries.reduce((sum,entry)=>sum+entry.sets.length,0)

  /*
   * Ce scrie pe rândul închis. Mockup-ul cere „n exercises · durată" plus
   * volumul — până acum era doar numărul de exerciții, deci rândul nu spunea
   * nimic despre cât de greu a fost antrenamentul.
   */
  const exerciseCount=`${entries.length} ${entries.length===1?'exercise':'exercises'}`
  const duration=active?'in progress':formatDuration(sessionDurationSeconds(session))
  const volume=formatVolume(sessionVolume(entries,session.id),system)

  return <div className={`session-card ${isOpen?'session-card-open':''} ${active&&isOpen?'active-workout-card':''}`}>
    <button type="button" className="session-card-header" onClick={onToggle} aria-expanded={isOpen}>
      <div className="session-card-title"><span className="session-date">{dayLabel(session.date)}</span><h3>{session.name||'Workout session'}</h3><span className="session-meta">{exerciseCount}{duration?` · ${duration}`:''}</span></div>{volume&&<span className="session-volume">{volume}</span>}<span className="session-chevron" aria-hidden="true">{isOpen?'−':'+'}</span>
    </button>
    {isOpen&&<div className="session-card-body">
      {active?<section className="active-workout-hero">
        <div className="active-workout-top"><span className="active-workout-kicker">ACTIVE WORKOUT</span><span>{entries.length} exercises</span></div>
        <h2>{session.name||'Workout session'}</h2>
        <WorkoutTimer startedAt={session.createdAt} endedAt={session.endedAt} sessionDate={session.date} onFinish={onFinishSession?()=>{if(window.confirm('Finish this workout session?'))onFinishSession()}:undefined}/>
        <div className="active-workout-progress"><div><span>{completedSets} sets logged</span><strong>{entries.length?'In progress':'Ready'}</strong></div><div className="active-workout-progress-track"><span style={{width:`${Math.min(100,entries.length*20)}%`}}/></div></div>
      </section>:<WorkoutTimer startedAt={session.createdAt} endedAt={session.endedAt} sessionDate={session.date}/>} 

      {entries.length>0&&<div className="logged-exercise-list">{entries.map((entry,index)=><div className="logged-exercise-card target-logged-exercise" key={entry.id}>{editingEntryId===entry.id?<ExerciseEntryForm exercises={exercises} fieldTypes={fieldTypes} historyFieldTypes={historyFieldTypes} getLastEntry={getLastEntry} initialEntry={entry} onUpdate={(updated)=>onUpdateEntry(entry.id,updated)} onCancel={()=>setEditingEntryId('')}/>:<><div className="logged-exercise-index">{index+1}</div><div className="logged-exercise-main"><strong>{entry.exerciseName}</strong><span>{entry.sets.map((set)=>formatSet(set,historyFieldTypes)).join(' · ')}</span></div><div className="logged-exercise-actions"><button type="button" onClick={()=>setEditingEntryId(entry.id)}>Edit</button>{onDeleteEntry&&<button type="button" className="danger-action" onClick={()=>{if(window.confirm(`Delete ${entry.exerciseName} from this log?`))onDeleteEntry(entry.id)}}>Delete</button>}</div></>}</div>)}</div>}

      {active&&<div className="add-exercise-panel target-add-exercise"><div className="target-add-exercise-heading"><span>Current exercise</span><strong>{entries.length?'Add another exercise':'Choose your first exercise'}</strong></div><ExerciseEntryForm exercises={exercises} fieldTypes={fieldTypes} historyFieldTypes={historyFieldTypes} getLastEntry={getLastEntry} onAdd={onAddEntry}/></div>}

      {!active&&addingEntry&&<div className="add-exercise-panel target-add-exercise"><div className="target-add-exercise-heading"><span>Add to this workout</span><strong>{dayLabel(session.date)}</strong></div><ExerciseEntryForm exercises={exercises} fieldTypes={fieldTypes} historyFieldTypes={historyFieldTypes} getLastEntry={getLastEntry} onAdd={onAddEntry} onCancel={()=>setAddingEntry(false)}/></div>}

      <div className="session-tools">{editing?<SessionForm initial={session} onSubmit={(date,name,durationSeconds)=>{if(!onUpdateSession(date,name,durationSeconds))return false;setEditing(false);return true}} onCancel={()=>setEditing(false)}/>:<>{!active&&!addingEntry&&<button type="button" onClick={()=>setAddingEntry(true)}>+ Add exercise</button>}<button type="button" onClick={()=>setEditing(true)}>Edit session</button>{onDeleteSession&&<button type="button" className="danger-action" onClick={()=>{if(window.confirm(`Delete ${session.name||'this workout session'} and all exercises logged in it? This cannot be undone.`))onDeleteSession()}}>Delete session</button>}</>}</div>
    </div>}
  </div>
}
