import { AboutSection } from '@/components/detail/about-section'

export function ProjectAbout(props: { description?: string | null }) {
	return <AboutSection description={props.description} />
}
