import {cookies} from "next/headers";
import {redirect} from "next/navigation";
import DemoApp from "@/components/DemoAppV6";
import {verifyStudentSession,verifyTeacherSession} from "@/lib/supabase-admin";

export default async function ProtectedTeacherRoute({params}:{params:Promise<{path?:string[]}>}){
 const store=await cookies();
 if(verifyStudentSession(store.get("maeum_student_session")?.value||""))redirect("/student/home");
 const {path=[]}=await params;
 if(path.length&& !verifyTeacherSession(store.get("maeum_teacher_session")?.value||""))redirect("/teacher");
 return <DemoApp/>;
}
